import { config } from "../config";

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export class LLMService {
  // Pollinations throttles anonymous users with intermittent HTTP 402.
  // Pace requests and treat 402 like a rate limit (retry with backoff).
  private static lastCallAt = 0;
  private static minIntervalMs = 12000;

  private static async pace(): Promise<void> {
    const elapsed = Date.now() - this.lastCallAt;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastCallAt = Date.now();
  }

  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 4,
    baseDelayMs: number = 15000
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const status = error?.status;
        const isProviderOutOfSpace = error?.code === "PROVIDER_OUT_OF_SPACE";
        // 402 from Pollinations == anonymous throttling, 429 == classic rate limit
        const isThrottled = status === 429 || status === 402;
        const isServerError = status >= 500;
        const isTimeout = error?.code === "ETIMEDOUT" || error?.code === "ECONNABORTED";

        if (attempt === maxRetries || isProviderOutOfSpace || (!isThrottled && !isServerError && !isTimeout)) {
          throw error;
        }

        const delay = baseDelayMs * Math.pow(1.5, attempt) + Math.random() * 3000;
        console.log(`[LLM] ${status || "error"} - retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retries exceeded");
  }

  private static async chatOllama(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.llmTimeoutMs);

    try {
      const response = await fetch(`${config.ollamaUrl}/api/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.ollamaModel,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 4096,
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        const error: any = new Error(`Ollama HTTP ${response.status}: ${errBody}`);
        error.code = "LOCAL_LLM_UNAVAILABLE";
        throw error;
      }

      const data: any = await response.json();
      const content = data.message?.content || "";
      if (!content) throw new Error("Ollama returned an empty response");
      return { content };
    } finally {
      clearTimeout(timeout);
    }
  }

  static async chat(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    options: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
    } = {}
  ): Promise<LLMResponse> {
    const { temperature = 0.7, maxTokens = 4096 } = options;

    // Prefer the local model; fall back to the hosted free tier when
    // Ollama is not running (e.g. deployed backend, clean clone).
    if (config.llmProvider === "ollama") {
      try {
        return await this.chatOllama(messages, { temperature, maxTokens });
      } catch (error: any) {
        console.warn(`[LLM] Ollama unavailable (${error.message}), falling back to hosted API`);
      }
    }

    return this.chatHosted(messages, { temperature, maxTokens });
  }

  private static async chatHosted(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<LLMResponse> {
    const { temperature = 0.7, maxTokens = 4096 } = options;

    return this.retryWithBackoff(async () => {
      await this.pace();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.llmTimeoutMs);

      try {
        const response = await fetch(POLLINATIONS_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.groqModel,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          const error: any = new Error(`LLM HTTP ${response.status}: ${errBody}`);
          error.status = response.status;
          if (errBody.includes("ENOSPC")) {
            error.code = "PROVIDER_OUT_OF_SPACE";
          }
          throw error;
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        return {
          content,
          usage: data.usage
            ? {
                prompt_tokens: data.usage.prompt_tokens || 0,
                completion_tokens: data.usage.completion_tokens || 0,
              }
            : undefined,
        };
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  static async chatJSON<T = any>(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<T> {
    const maxAttempts = 3;
    let lastError: Error = new Error("INVALID_JSON_RESPONSE");

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.chat(messages, options);
      const result = this.tryParseJSON<T>(response.content);
      if (result !== null) return result;

      lastError = new Error(`INVALID_JSON_RESPONSE (attempt ${attempt + 1})`);
      console.warn(`[LLM] Invalid JSON on attempt ${attempt + 1}, retrying...`);
    }

    throw lastError;
  }

  private static tryParseJSON<T>(content: string): T | null {
    if (!content || !content.trim()) return null;

    // Attempt 1: direct parse
    try {
      return JSON.parse(content.trim()) as T;
    } catch {}

    // Attempt 2: extract from markdown code blocks
    const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try {
        return JSON.parse(codeBlock[1].trim()) as T;
      } catch {}
    }

    // Attempt 3: find the outermost JSON object or array
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      const candidate = jsonMatch[1];
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Attempt 4: repair common issues
        try {
          return JSON.parse(this.repairJSON(candidate)) as T;
        } catch {}
      }
    }

    return null;
  }

  /**
   * Attempt to fix common LLM JSON issues:
   * - trailing commas before ] or }
   * - single quotes instead of double quotes
   * - unclosed strings
   * - unclosed brackets
   */
  private static repairJSON(raw: string): string {
    let s = raw;

    // Remove trailing commas: ,] or ,} or ,\n]
    s = s.replace(/,\s*([\]}])/g, "$1");

    // Close unclosed strings (count unescaped quotes per line is complex;
    // instead: if the string ends mid-value with an open quote, close it)
    const quotes = (s.match(/(?<!\\)"/g) || []).length;
    if (quotes % 2 !== 0) {
      s += '"';
    }

    // Close unclosed brackets
    const openBraces = (s.match(/\{/g) || []).length;
    const closeBraces = (s.match(/\}/g) || []).length;
    const openBrackets = (s.match(/\[/g) || []).length;
    const closeBrackets = (s.match(/\]/g) || []).length;

    // Close strings first if needed, then close brackets in reverse order
    if (openBrackets > closeBrackets) {
      s += "]".repeat(openBrackets - closeBrackets);
    }
    if (openBraces > closeBraces) {
      s += "}".repeat(openBraces - closeBraces);
    }

    return s;
  }
}
