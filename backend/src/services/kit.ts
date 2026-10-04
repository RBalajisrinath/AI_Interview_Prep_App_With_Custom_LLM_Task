import { KitModel } from "../models/Kit";
import { Kit, KitInput, Question, Flashcard } from "../types/kit";
import { CrawlerService } from "./crawler";
import { ExtractionService } from "./extraction";
import { GenerationService } from "./generation";
import { v4 as uuidv4 } from "uuid";

export class KitService {
  /**
   * Create the kit document in "generating" state and return it immediately.
   * Call runPipeline() afterwards (awaited or in background).
   */
  static async startKit(userId: string, input: KitInput): Promise<Kit> {
    const kitId = uuidv4();
    const now = new Date().toISOString();

    // Create initial draft
    const kit = await KitModel.create({
      id: kitId,
      user_id: userId,
      source: {
        company: input.company || "",
        company_url: input.company_url,
        role: input.role || "",
        location: input.location || "",
        jd_chars: input.jd.length,
        researched_at: now,
        pages_used: [],
        jd: input.jd,
      },
      company_brief: { summary: "", what_they_do: "", sources: [] },
      role: { title: "", seniority: "", responsibilities: [], requirements: [] },
      questions: [],
      flashcards: [],
      schedule: { days_available: input.days, days: [] },
      coverage: { uncovered_requirement_ids: [], passes: 0 },
      status: "generating",
    });

    return kit.toObject() as Kit;
  }

  /**
   * Full pipeline: extract → crawl → generate → coverage check.
   * Updates the kit document to "ready" (or "failed") when done.
   * Same code path for web (background) and batch (awaited).
   */
  static async runPipeline(kitId: string, input: KitInput): Promise<Kit> {
    const now = new Date().toISOString();

    try {
      // Step 1: Extract requirements from JD
      const extraction = await ExtractionService.extractFromJD(input.jd);

      // Step 2: Crawl company site
      const crawler = new CrawlerService();
      const crawlResult = await crawler.crawl(input.company_url);

      // Step 3: Generate kit content
      const generation = new GenerationService({
        jd: input.jd,
        company: extraction.company || input.company || "",
        companyUrl: input.company_url,
        role: extraction.title,
        location: extraction.location,
        requirements: extraction.requirements.map((r, i) => ({ ...r, id: `r${i + 1}` })),
        responsibilities: extraction.responsibilities,
        crawledPages: crawlResult.pages,
        hiringPages: crawlResult.hiring_pages,
        aboutPages: crawlResult.about_pages,
        daysAvailable: input.days,
      });

      const generated = await generation.generate();

      // Step 4: Update kit with generated content
      const updated = await KitModel.findOneAndUpdate(
        { id: kitId },
        {
          source: {
            company: extraction.company || input.company || "",
            company_url: input.company_url,
            role: extraction.title,
            location: extraction.location,
            jd_chars: input.jd.length,
            researched_at: now,
            pages_used: [...new Set([input.company_url, ...crawlResult.pages.map((p) => p.url)])],
          },
          company_brief: generated.company_brief,
          role: {
            title: extraction.title,
            seniority: extraction.seniority,
            responsibilities: extraction.responsibilities,
            requirements: extraction.requirements.map((r, i) => ({ ...r, id: `r${i + 1}` })),
          },
          questions: generated.questions,
          flashcards: generated.flashcards,
          schedule: generated.schedule,
          coverage: generated.coverage,
          status: "ready",
          updated_at: new Date().toISOString(),
        },
        { new: true }
      );

      return updated!.toObject() as Kit;
    } catch (error: any) {
      await KitModel.findOneAndUpdate(
        { id: kitId },
        { status: "failed", updated_at: new Date().toISOString() }
      );
      throw error;
    }
  }

  /**
   * Synchronous wrapper (used by the batch entry point):
   * starts the kit and awaits the full pipeline.
   */
  static async createKit(userId: string, input: KitInput): Promise<Kit> {
    const started = await this.startKit(userId, input);
    return this.runPipeline(started.id, input);
  }

  static async getUserKits(userId: string): Promise<Kit[]> {
    const kits = await KitModel.find({ user_id: userId }).sort({ created_at: -1 });
    return kits.map((k) => k.toObject() as Kit);
  }

  static async getKit(userId: string, kitId: string): Promise<Kit | null> {
    const kit = await KitModel.findOne({ id: kitId, user_id: userId });
    return kit ? (kit.toObject() as Kit) : null;
  }

  static async updateKit(userId: string, kitId: string, updates: Partial<Kit>): Promise<Kit | null> {
    updates.updated_at = new Date().toISOString();
    const kit = await KitModel.findOneAndUpdate(
      { id: kitId, user_id: userId },
      { $set: updates },
      { new: true }
    );
    return kit ? (kit.toObject() as Kit) : null;
  }

  static async deleteKit(userId: string, kitId: string): Promise<boolean> {
    const result = await KitModel.deleteOne({ id: kitId, user_id: userId });
    return result.deletedCount > 0;
  }

  /**
   * Regenerate a single section without affecting other sections.
   * Preserves user edits (origin: "edited" or "pinned") in other sections.
   */
  static async regenerateSection(
    userId: string,
    kitId: string,
    section: "company_brief" | "questions" | "schedule" | "flashcards"
  ): Promise<Kit | null> {
    const kit = await KitModel.findOne({ id: kitId, user_id: userId });
    if (!kit) return null;

    const requirements = kit.role.requirements;

    if (section === "company_brief") {
      const crawler = new CrawlerService();
      const crawlResult = await crawler.crawl(kit.source.company_url);
      const generation = new GenerationService({
        jd: "", // Not needed for brief regeneration
        company: kit.source.company,
        companyUrl: kit.source.company_url,
        role: kit.role.title,
        location: kit.source.location,
        requirements,
        responsibilities: kit.role.responsibilities,
        crawledPages: crawlResult.pages,
        hiringPages: crawlResult.hiring_pages,
        aboutPages: crawlResult.about_pages,
        daysAvailable: kit.schedule.days_available,
      });
      const brief = await generation.generateCompanyBrief();
      kit.company_brief = brief;
    } else if (section === "questions") {
      // Preserve user-edited questions
      const preservedQuestions = kit.questions.filter(
        (q) => q.origin === "edited" || q.origin === "pinned"
      );
      const generation = new GenerationService({
        jd: kit.source.jd || "",
        company: kit.source.company,
        companyUrl: kit.source.company_url,
        role: kit.role.title,
        location: kit.source.location,
        requirements,
        responsibilities: kit.role.responsibilities,
        crawledPages: [],
        hiringPages: [],
        aboutPages: [],
        daysAvailable: kit.schedule.days_available,
      });
      // Map requirement kinds to valid question categories
      const kindToCategory: Record<string, string> = {
        technical: "technical",
        behavioural: "behavioural",
        domain: "company-fit",
      };
      const categories = [
        ...new Set(
          requirements
            .map((r) => kindToCategory[r.kind])
            .filter((c): c is string => Boolean(c))
        ),
      ];
      const newQuestions: Question[] = [];
      for (const cat of categories) {
        const qs = await generation.generateQuestionsForCategory(cat);
        newQuestions.push(...qs);
      }
      // Fail loudly rather than silently wiping the question bank
      if (newQuestions.length === 0 && preservedQuestions.length === 0) {
        throw new Error(
          "Question generation returned no results (LLM throttled). Try again in a minute."
        );
      }
      const allQuestions = [...preservedQuestions, ...newQuestions];
      // Regenerate schedule so it references the new question ids
      const { ScheduleService } = await import("./schedule.js");
      const { CoverageService } = await import("./coverage.js");
      kit.schedule = ScheduleService.buildSchedule(
        allQuestions,
        requirements,
        kit.schedule.days_available
      );
      kit.coverage = {
        uncovered_requirement_ids: CoverageService.findGaps(requirements, allQuestions),
        passes: kit.coverage.passes + 1,
      };
      kit.questions = allQuestions;
    } else if (section === "flashcards") {
      const preservedCards = kit.flashcards.filter(
        (f) => f.origin === "edited" || f.origin === "pinned"
      );
      const generation = new GenerationService({
        jd: kit.source.jd || "",
        company: kit.source.company,
        companyUrl: kit.source.company_url,
        role: kit.role.title,
        location: kit.source.location,
        requirements,
        responsibilities: kit.role.responsibilities,
        crawledPages: [],
        hiringPages: [],
        aboutPages: [],
        daysAvailable: kit.schedule.days_available,
      });
      const newCards = await generation.generateFlashcards(kit.questions);
      kit.flashcards = [...preservedCards, ...newCards];
    } else if (section === "schedule") {
      const { ScheduleService } = await import("./schedule.js");
      kit.schedule = ScheduleService.buildSchedule(
        kit.questions,
        requirements,
        kit.schedule.days_available
      );
    }

    kit.updated_at = new Date().toISOString();
    await kit.save();
    return kit.toObject() as Kit;
  }
}
