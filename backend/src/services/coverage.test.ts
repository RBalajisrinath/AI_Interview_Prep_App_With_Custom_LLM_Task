import { describe, it, expect } from "vitest";
import { CoverageService } from "./coverage";
import { Requirement, Question } from "../types/kit";

describe("CoverageService", () => {
  const requirements: Requirement[] = [
    { id: "r1", text: "React", kind: "technical", priority: "must" },
    { id: "r2", text: "Node.js", kind: "technical", priority: "must" },
    { id: "r3", text: "AWS", kind: "technical", priority: "nice" },
    { id: "r4", text: "Communication", kind: "behavioural", priority: "must" },
  ];

  it("finds uncovered requirements", () => {
    const questions: Question[] = [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "Q1", answer_outline: "A1", difficulty: 2 },
      { id: "q2", requirement_ids: ["r2"], category: "technical", prompt: "Q2", answer_outline: "A2", difficulty: 2 },
    ];
    const gaps = CoverageService.findGaps(requirements, questions);
    expect(gaps).toContain("r3");
    expect(gaps).toContain("r4");
    expect(gaps).not.toContain("r1");
    expect(gaps).not.toContain("r2");
  });

  it("returns empty when all covered", () => {
    const questions: Question[] = [
      { id: "q1", requirement_ids: ["r1", "r2", "r3", "r4"], category: "technical", prompt: "Q1", answer_outline: "A1", difficulty: 2 },
    ];
    const gaps = CoverageService.findGaps(requirements, questions);
    expect(gaps).toHaveLength(0);
  });

  it("isComplete returns true when all must-haves covered", () => {
    const questions: Question[] = [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "Q1", answer_outline: "A1", difficulty: 2 },
      { id: "q2", requirement_ids: ["r2"], category: "technical", prompt: "Q2", answer_outline: "A2", difficulty: 2 },
      { id: "q3", requirement_ids: ["r4"], category: "behavioural", prompt: "Q3", answer_outline: "A3", difficulty: 2 },
    ];
    expect(CoverageService.isComplete(requirements, questions)).toBe(true);
  });

  it("isComplete returns false when must-haves missing", () => {
    const questions: Question[] = [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "Q1", answer_outline: "A1", difficulty: 2 },
    ];
    expect(CoverageService.isComplete(requirements, questions)).toBe(false);
  });
});
