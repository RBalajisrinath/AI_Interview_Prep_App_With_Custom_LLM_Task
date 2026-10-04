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

export interface Kit {
  id: string;
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: {
    days_available: number;
    days: ScheduleDay[];
  };
  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
  status: "draft" | "generating" | "ready" | "failed";
  created_at: string;
  updated_at: string;
}
