export interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: "technical" | "behavioural" | "system-design" | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  origin?: "generated" | "edited" | "pinned";
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  origin?: "generated" | "edited" | "pinned";
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Coverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export interface RoleBreakdown {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
  /** Extension: original job description, kept so sections can be regenerated with full context */
  jd?: string;
}

export interface Kit {
  id: string;
  user_id: string;
  source: KitSource;
  company_brief: CompanyBrief;
  role: RoleBreakdown;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: {
    days_available: number;
    days: ScheduleDay[];
  };
  coverage: Coverage;
  status: "draft" | "generating" | "ready" | "failed";
  created_at: string;
  updated_at: string;
}

export interface KitInput {
  jd: string;
  company_url: string;
  days: number;
  company?: string;
  role?: string;
  location?: string;
}

export interface BatchCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export interface BatchOutput {
  version: string;
  generated_at: string;
  kits: BatchResult[];
}

export interface BatchResult {
  id: string;
  status: "ok" | "failed";
  kit: Kit | null;
  error: {
    code: string;
    message: string;
  } | null;
}
