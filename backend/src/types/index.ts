export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export interface PracticeCard {
  flashcard_id: string;
  confidence: number;
  last_reviewed: string;
  review_count: number;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  kit_id: string;
  cards: PracticeCard[];
  created_at: string;
  updated_at: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  content: string;
  links: string[];
  status: number;
  fetched_at: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  hiring_pages: CrawledPage[];
  about_pages: CrawledPage[];
  errors: { url: string; error: string }[];
}

export interface GenerationProgress {
  step: string;
  status: "pending" | "running" | "done" | "error";
  message?: string;
}
