import { LLMService } from "./llm";
import { CoverageService } from "./coverage";
import { ScheduleService } from "./schedule";
import { Requirement, Question, Flashcard, CompanyBrief, RoleBreakdown } from "../types/kit";
import { CrawledPage } from "../types";
import { v4 as uuidv4 } from "uuid";

interface GenerationContext {
  jd: string;
  company: string;
  companyUrl: string;
  role: string;
  location: string;
  requirements: Requirement[];
  responsibilities: string[];
  crawledPages: CrawledPage[];
  hiringPages: CrawledPage[];
  aboutPages: CrawledPage[];
  daysAvailable: number;
}

export class GenerationService {
  private ctx: GenerationContext;
  private pagesUsed: string[] = [];

  constructor(ctx: GenerationContext) {
    this.ctx = ctx;
  }

  async generate(): Promise<{
    company_brief: CompanyBrief;
    questions: Question[];
    flashcards: Flashcard[];
    schedule: { days_available: number; days: any[] };
    coverage: { uncovered_requirement_ids: string[]; passes: number };
  }> {
    // Step 1: Generate company brief
    const company_brief = await this.generateCompanyBrief();

    // Step 2: Generate questions per category (separate calls)
    const questions: Question[] = [];
    const categories = this.determineCategories();

    for (const category of categories) {
      const categoryQuestions = await this.generateQuestionsForCategory(category);
      questions.push(...categoryQuestions);
    }

    // Step 3: Coverage check and second pass
    let passes = 1;
    let uncovered = CoverageService.findGaps(this.ctx.requirements, questions);
    const maxPasses = 3;

    while (uncovered.length > 0 && passes < maxPasses) {
      const gapQuestions = await this.generateQuestionsForGaps(uncovered);
      questions.push(...gapQuestions);
      passes++;
      uncovered = CoverageService.findGaps(this.ctx.requirements, questions);
    }

    // Step 4: Generate flashcards
    const flashcards = await this.generateFlashcards(questions);

    // Step 5: Build schedule (deterministic)
    const schedule = ScheduleService.buildSchedule(
      questions,
      this.ctx.requirements,
      this.ctx.daysAvailable
    );

    return {
      company_brief,
      questions,
      flashcards,
      schedule,
      coverage: { uncovered_requirement_ids: uncovered, passes },
    };
  }

  determineCategories(): string[] {
    const categories = new Set<string>();
    for (const req of this.ctx.requirements) {
      if (req.kind === "technical") categories.add("technical");
      if (req.kind === "behavioural") categories.add("behavioural");
      if (req.kind === "domain") categories.add("company-fit");
    }
    // Always include company-fit
    categories.add("company-fit");
    // Add system-design for senior roles
    if (["senior", "staff", "lead"].includes(this.ctx.role)) {
      categories.add("system-design");
    }
    return [...categories];
  }

  async generateCompanyBrief(): Promise<CompanyBrief> {
    const relevantPages = [...this.ctx.aboutPages, ...this.ctx.hiringPages].slice(0, 5);
    const pageContent = relevantPages.map((p) => `URL: ${p.url}\nTitle: ${p.title}\nContent: ${p.content.slice(0, 2000)}`).join("\n\n---\n\n");
    this.pagesUsed = relevantPages.map((p) => p.url);

    const systemPrompt = `You are a research analyst. Write a concise company brief based on the crawled pages.
Return JSON: { "summary": "2-3 sentence overview", "what_they_do": "what the company does, its products, mission", "sources": ["url1", "url2"] }
Be honest: if little information was found, say so. Do not fabricate facts.`;

    try {
      const result = await LLMService.chatJSON<CompanyBrief>([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Company: ${this.ctx.company}\nURL: ${this.ctx.companyUrl}\n\nCrawled pages:\n${pageContent || "No pages could be retrieved."}` },
      ], { temperature: 0.3, maxTokens: 1000 });

      return {
        summary: result.summary || "No information available.",
        what_they_do: result.what_they_do || "No information available.",
        sources: result.sources || this.pagesUsed,
      };
    } catch {
      return {
        summary: `Brief for ${this.ctx.company}. Limited information available from public sources.`,
        what_they_do: "Could not be determined from available sources.",
        sources: this.pagesUsed,
      };
    }
  }

  async generateQuestionsForCategory(category: string): Promise<Question[]> {
    const categoryReqs = this.ctx.requirements.filter((r) => {
      if (category === "technical") return r.kind === "technical";
      if (category === "behavioural") return r.kind === "behavioural";
      if (category === "company-fit") return r.kind === "domain";
      return true; // system-design gets all
    });

    if (categoryReqs.length === 0 && category !== "company-fit") return [];

    const hiringContext = this.ctx.hiringPages.length > 0
      ? `\n\nHiring process information:\n${this.ctx.hiringPages.map((p) => p.content.slice(0, 1000)).join("\n\n")}`
      : "";

    const systemPrompt = `You are an expert interview coach. Generate ${category} interview questions for the role.
Return JSON: { "questions": [{ "requirement_ids": ["r1"], "prompt": "...", "answer_outline": "...", "difficulty": 1-3 }] }
Rules:
- Generate 3-5 questions per requirement.
- Questions must be specific to the role and company.
- difficulty: 1 (easy) to 3 (hard).
- Reference requirement_ids from the provided list.
- Do not invent requirements not in the list.`;

    const reqsText = categoryReqs.map((r) => `${r.id}: ${r.text} (${r.priority})`).join("\n");

    try {
      const result = await LLMService.chatJSON<{ questions: any[] }>([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Role: ${this.ctx.role}\nCompany: ${this.ctx.company}\nRequirements:\n${reqsText}${hiringContext}\n\nJob description:\n${this.ctx.jd.slice(0, 3000)}` },
      ], { temperature: 0.7, maxTokens: 3000 });

      return (result.questions || []).map((q: any) => ({
        id: `q_${uuidv4().slice(0, 8)}`,
        requirement_ids: q.requirement_ids || [],
        category: category as Question["category"],
        prompt: q.prompt || "",
        answer_outline: q.answer_outline || "",
        difficulty: Math.min(3, Math.max(1, q.difficulty || 2)) as 1 | 2 | 3,
        origin: "generated" as const,
      }));
    } catch (error) {
      console.error(`[Generation] Failed to generate ${category} questions:`, error);
      return [];
    }
  }

  private async generateQuestionsForGaps(gapIds: string[]): Promise<Question[]> {
    const gapReqs = this.ctx.requirements.filter((r) => gapIds.includes(r.id));
    const systemPrompt = `Generate interview questions for these uncovered requirements.
Return JSON: { "questions": [{ "requirement_ids": ["r1"], "prompt": "...", "answer_outline": "...", "difficulty": 1-3 }] }
Generate 2-3 questions per requirement.`;

    const reqsText = gapReqs.map((r) => `${r.id}: ${r.text} (${r.kind}, ${r.priority})`).join("\n");

    try {
      const result = await LLMService.chatJSON<{ questions: any[] }>([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Role: ${this.ctx.role}\nRequirements:\n${reqsText}` },
      ], { temperature: 0.7, maxTokens: 2000 });

      return (result.questions || []).map((q: any) => ({
        id: `q_${uuidv4().slice(0, 8)}`,
        requirement_ids: q.requirement_ids || [],
        category: gapReqs[0]?.kind === "behavioural" ? "behavioural" : "technical",
        prompt: q.prompt || "",
        answer_outline: q.answer_outline || "",
        difficulty: Math.min(3, Math.max(1, q.difficulty || 2)) as 1 | 2 | 3,
        origin: "generated" as const,
      }));
    } catch {
      return [];
    }
  }

  async generateFlashcards(questions: Question[]): Promise<Flashcard[]> {
    const systemPrompt = `Create flashcards from these interview questions for quick review.
Return JSON: { "flashcards": [{ "front": "question or concept", "back": "key points to remember", "requirement_ids": ["r1"] }] }
Create 1 flashcard per question. Keep fronts concise, backs focused on key points.`;

    const cards: Flashcard[] = [];

    // Small batches: large outputs get truncated by small/flaky models,
    // which is what used to produce zero flashcards.
    const BATCH = 8;
    for (let i = 0; i < questions.length; i += BATCH) {
      const batch = questions.slice(i, i + BATCH);
      const questionsText = batch
        .map((q) => `Q: ${q.prompt}\nA: ${q.answer_outline}\nReqs: ${q.requirement_ids.join(", ")}`)
        .join("\n\n");

      try {
        const result = await LLMService.chatJSON<{ flashcards: any[] }>(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: questionsText },
          ],
          { temperature: 0.5, maxTokens: 2000 }
        );

        for (const f of result.flashcards || []) {
          const card: Flashcard = {
            id: `f_${uuidv4().slice(0, 8)}`,
            front: f.front || "",
            back: f.back || "",
            requirement_ids: f.requirement_ids || [],
            origin: "generated" as const,
          };
          if (!card.front || !card.back) continue;
          cards.push(card);
        }
      } catch (error) {
        console.warn(`[Generation] Flashcard batch ${i / BATCH + 1} failed, using fallback`);
      }
    }

    // Deterministic fallback: every question gets at least one card, so a
    // failed LLM call degrades to plain Q/A cards instead of zero cards.
    const haveFronts = new Set(cards.map((c) => c.front));
    for (const q of questions) {
      const already = cards.some((c) => c.requirement_ids.some((r) => q.requirement_ids.includes(r)));
      if (!already && !haveFronts.has(q.prompt)) {
        cards.push({
          id: `f_${uuidv4().slice(0, 8)}`,
          front: q.prompt,
          back: q.answer_outline.slice(0, 500),
          requirement_ids: [...q.requirement_ids],
          origin: "generated" as const,
        });
      }
    }

    return cards;
  }
}
