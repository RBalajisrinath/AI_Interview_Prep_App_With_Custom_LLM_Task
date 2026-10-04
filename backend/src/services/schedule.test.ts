import { describe, it, expect } from "vitest";
import { ScheduleService } from "./schedule";
import { Requirement, Question } from "../types/kit";

describe("ScheduleService", () => {
  const requirements: Requirement[] = [
    { id: "r1", text: "React", kind: "technical", priority: "must" },
    { id: "r2", text: "Node.js", kind: "technical", priority: "must" },
    { id: "r3", text: "Communication", kind: "behavioural", priority: "nice" },
  ];

  const questions: Question[] = [
    { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "Q1", answer_outline: "A1", difficulty: 3 },
    { id: "q2", requirement_ids: ["r2"], category: "technical", prompt: "Q2", answer_outline: "A2", difficulty: 2 },
    { id: "q3", requirement_ids: ["r3"], category: "behavioural", prompt: "Q3", answer_outline: "A3", difficulty: 1 },
  ];

  it("creates the correct number of days", () => {
    const schedule = ScheduleService.buildSchedule(questions, requirements, 5);
    expect(schedule.days).toHaveLength(5);
    expect(schedule.days_available).toBe(5);
  });

  it("covers all must-have requirements", () => {
    const schedule = ScheduleService.buildSchedule(questions, requirements, 3);
    const allQuestionIds = schedule.days.flatMap((d) => d.question_ids);
    const coveredReqs = new Set<string>();
    for (const q of questions) {
      if (allQuestionIds.includes(q.id)) {
        q.requirement_ids.forEach((r) => coveredReqs.add(r));
      }
    }
    expect(coveredReqs.has("r1")).toBe(true);
    expect(coveredReqs.has("r2")).toBe(true);
  });

  it("assigns integer minutes to each day", () => {
    const schedule = ScheduleService.buildSchedule(questions, requirements, 4);
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThan(0);
    }
  });

  it("puts harder questions earlier", () => {
    const schedule = ScheduleService.buildSchedule(questions, requirements, 3);
    // q1 (difficulty 3) should appear before q3 (difficulty 1)
    const q1Day = schedule.days.find((d) => d.question_ids.includes("q1"))?.day;
    const q3Day = schedule.days.find((d) => d.question_ids.includes("q3"))?.day;
    expect(q1Day).toBeLessThanOrEqual(q3Day!);
  });

  it("handles 1 day", () => {
    const schedule = ScheduleService.buildSchedule(questions, requirements, 1);
    expect(schedule.days).toHaveLength(1);
  });

  it("handles 60 days", () => {
    const schedule = ScheduleService.buildSchedule(questions, requirements, 60);
    expect(schedule.days).toHaveLength(60);
  });

  it("clamps days below 1 to 1", () => {
    const schedule = ScheduleService.buildSchedule(questions, requirements, 0);
    expect(schedule.days).toHaveLength(1);
  });

  it("clamps days above 60 to 60", () => {
    const schedule = ScheduleService.buildSchedule(questions, requirements, 100);
    expect(schedule.days).toHaveLength(60);
  });
});
