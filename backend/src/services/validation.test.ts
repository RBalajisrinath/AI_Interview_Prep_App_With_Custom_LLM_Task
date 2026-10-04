import { describe, it, expect } from "vitest";
import { Kit } from "../types/kit";

// Simple structure validation for kits
function validateKitStructure(kit: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required top-level fields
  const requiredFields = ["source", "company_brief", "role", "questions", "flashcards", "schedule", "coverage"];
  for (const field of requiredFields) {
    if (!(field in kit)) {
      errors.push(`Missing field: ${field}`);
    }
  }

  // Source validation
  if (kit.source) {
    for (const field of ["company", "company_url", "role", "location", "jd_chars", "researched_at", "pages_used"]) {
      if (!(field in kit.source)) {
        errors.push(`Missing source field: ${field}`);
      }
    }
  }

  // Role validation
  if (kit.role) {
    for (const field of ["title", "seniority", "responsibilities", "requirements"]) {
      if (!(field in kit.role)) {
        errors.push(`Missing role field: ${field}`);
      }
    }
    if (Array.isArray(kit.role.requirements)) {
      for (const req of kit.role.requirements) {
        if (!req.id || !req.text || !req.kind || !req.priority) {
          errors.push("Requirement missing required fields");
        }
        if (!["technical", "behavioural", "domain"].includes(req.kind)) {
          errors.push(`Invalid requirement kind: ${req.kind}`);
        }
        if (!["must", "nice"].includes(req.priority)) {
          errors.push(`Invalid requirement priority: ${req.priority}`);
        }
      }
    }
  }

  // Questions validation
  if (Array.isArray(kit.questions)) {
    for (const q of kit.questions) {
      if (!q.id || !q.prompt || !q.answer_outline || !q.category || !q.difficulty) {
        errors.push("Question missing required fields");
      }
      if (!["technical", "behavioural", "system-design", "company-fit"].includes(q.category)) {
        errors.push(`Invalid question category: ${q.category}`);
      }
      if (q.difficulty < 1 || q.difficulty > 3) {
        errors.push(`Invalid difficulty: ${q.difficulty}`);
      }
      if (!Number.isInteger(q.difficulty)) {
        errors.push(`Difficulty must be integer: ${q.difficulty}`);
      }
    }
  }

  // Flashcards validation
  if (Array.isArray(kit.flashcards)) {
    for (const f of kit.flashcards) {
      if (!f.id || !f.front || !f.back) {
        errors.push("Flashcard missing required fields");
      }
    }
  }

  // Schedule validation
  if (kit.schedule) {
    if (!Number.isInteger(kit.schedule.days_available)) {
      errors.push("days_available must be integer");
    }
    if (Array.isArray(kit.schedule.days)) {
      for (const day of kit.schedule.days) {
        if (!Number.isInteger(day.day) || !day.focus || !Array.isArray(day.question_ids) || !Number.isInteger(day.minutes)) {
          errors.push("Schedule day missing required fields or invalid types");
        }
      }
    }
  }

  // Coverage validation
  if (kit.coverage) {
    if (!Array.isArray(kit.coverage.uncovered_requirement_ids)) {
      errors.push("uncovered_requirement_ids must be array");
    }
    if (!Number.isInteger(kit.coverage.passes)) {
      errors.push("passes must be integer");
    }
  }

  return { valid: errors.length === 0, errors };
}

describe("Kit Structure Validation", () => {
  it("validates a correct kit structure", () => {
    const kit = {
      source: {
        company: "TestCo",
        company_url: "https://testco.com",
        role: "Engineer",
        location: "Remote",
        jd_chars: 1000,
        researched_at: "2026-01-01T00:00:00Z",
        pages_used: ["https://testco.com"],
      },
      company_brief: { summary: "Test", what_they_do: "Testing", sources: [] },
      role: {
        title: "Engineer",
        seniority: "senior",
        responsibilities: ["Code"],
        requirements: [{ id: "r1", text: "React", kind: "technical", priority: "must" }],
      },
      questions: [
        { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "Q", answer_outline: "A", difficulty: 2 },
      ],
      flashcards: [{ id: "f1", front: "F", back: "B", requirement_ids: ["r1"] }],
      schedule: { days_available: 5, days: [{ day: 1, focus: "Test", question_ids: ["q1"], minutes: 60 }] },
      coverage: { uncovered_requirement_ids: [], passes: 1 },
    };

    const result = validateKitStructure(kit);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects missing fields", () => {
    const kit = { source: {}, questions: [] };
    const result = validateKitStructure(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("detects invalid difficulty", () => {
    const kit = {
      source: { company: "A", company_url: "https://a.com", role: "R", location: "L", jd_chars: 1, researched_at: "2026", pages_used: [] },
      company_brief: { summary: "S", what_they_do: "W", sources: [] },
      role: { title: "T", seniority: "mid", responsibilities: [], requirements: [] },
      questions: [{ id: "q1", requirement_ids: [], category: "technical", prompt: "P", answer_outline: "A", difficulty: 5 }],
      flashcards: [],
      schedule: { days_available: 1, days: [] },
      coverage: { uncovered_requirement_ids: [], passes: 0 },
    };
    const result = validateKitStructure(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("difficulty"))).toBe(true);
  });

  it("detects non-integer minutes", () => {
    const kit = {
      source: { company: "A", company_url: "https://a.com", role: "R", location: "L", jd_chars: 1, researched_at: "2026", pages_used: [] },
      company_brief: { summary: "S", what_they_do: "W", sources: [] },
      role: { title: "T", seniority: "mid", responsibilities: [], requirements: [] },
      questions: [],
      flashcards: [],
      schedule: { days_available: 1, days: [{ day: 1, focus: "F", question_ids: [], minutes: 60.5 }] },
      coverage: { uncovered_requirement_ids: [], passes: 0 },
    };
    const result = validateKitStructure(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Schedule day missing required fields"))).toBe(true);
  });
});
