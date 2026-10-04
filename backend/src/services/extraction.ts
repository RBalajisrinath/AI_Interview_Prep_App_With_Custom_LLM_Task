import { LLMService } from "./llm";
import { Requirement } from "../types/kit";

interface ExtractionResult {
  requirements: Omit<Requirement, "id">[];
  title: string;
  seniority: string;
  responsibilities: string[];
  location: string;
  company: string;
}

export class ExtractionService {
  static async extractFromJD(jd: string): Promise<ExtractionResult> {
    const systemPrompt = `You are an expert job description analyst. Extract structured information from job descriptions.
Return JSON with this exact shape:
{
  "requirements": [{ "text": "...", "kind": "technical|behavioural|domain", "priority": "must|nice" }],
  "title": "job title",
  "seniority": "one of junior, mid, senior, staff, lead - pick exactly one, do not list them",
  "responsibilities": ["..."],
  "location": "location or remote",
  "company": "company name only if explicitly stated in the JD, otherwise empty string"
}

Rules:
- Requirements must be explicitly stated in the JD. Do NOT invent requirements.
- seniority must be a single value, not the list of options.
- company must be "" if the JD does not name the company.
- "must" priority for required qualifications, "nice" for preferred/bonus.
- kind: "technical" for hard skills/tools, "behavioural" for soft skills/collaboration, "domain" for industry knowledge.
- If the JD is very short, extract only what is there. A thin JD produces a thin result.
- Keep requirement text concise but specific.`;

    const response = await LLMService.chatJSON<ExtractionResult>([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Job description:\n\n${jd}` },
    ], { temperature: 0.3, maxTokens: 2000 });

    // Validate and clean
    const requirements = (response.requirements || [])
      .filter((r: any) => r.text && r.text.trim().length > 0)
      .map((r: any, i: number) => ({
        text: r.text.trim(),
        kind: this.validateKind(r.kind),
        priority: r.priority === "nice" ? "nice" as const : "must" as const,
      }));

    return {
      requirements,
      title: response.title || "Unknown Role",
      seniority: this.validateSeniority(response.seniority),
      responsibilities: response.responsibilities || [],
      location: response.location || "Not specified",
      company: response.company || "",
    };
  }

  private static validateKind(kind: string): "technical" | "behavioural" | "domain" {
    if (kind === "technical" || kind === "behavioural" || kind === "domain") return kind;
    return "technical";
  }

  private static validateSeniority(seniority: string): string {
    const s = (seniority || "").toLowerCase().trim();
    if (["junior", "mid", "senior", "staff", "lead"].includes(s)) return s;
    if (s.includes("staff")) return "staff";
    if (s.includes("senior") || s.includes("lead")) return "senior";
    if (s.includes("junior")) return "junior";
    return "mid";
  }
}
