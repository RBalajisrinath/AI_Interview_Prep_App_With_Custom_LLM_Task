import { Requirement, Question, ScheduleDay } from "../types/kit";

export class ScheduleService {
  /**
   * Deterministically allocate questions across the given number of days.
   * Harder and higher-priority material lands earlier.
   * Every must-have requirement appears somewhere in the schedule.
   */
  static buildSchedule(
    questions: Question[],
    requirements: Requirement[],
    daysAvailable: number
  ): { days_available: number; days: ScheduleDay[] } {
    if (daysAvailable < 1) daysAvailable = 1;
    if (daysAvailable > 60) daysAvailable = 60;

    const mustRequirements = requirements.filter((r) => r.priority === "must");
    const niceRequirements = requirements.filter((r) => r.priority === "nice");

    // Score questions: higher score = should be scheduled earlier
    const scored = questions.map((q) => {
      const reqs = requirements.filter((r) => q.requirement_ids.includes(r.id));
      const hasMust = reqs.some((r) => r.priority === "must");
      const avgDifficulty = q.difficulty;
      const score = (hasMust ? 100 : 0) + avgDifficulty * 10 + (3 - q.difficulty);
      return { question: q, score };
    });

    // Sort by score descending (harder/higher-priority first)
    scored.sort((a, b) => b.score - a.score);

    // Distribute across days using round-robin with priority weighting
    const days: ScheduleDay[] = Array.from({ length: daysAvailable }, (_, i) => ({
      day: i + 1,
      focus: "",
      question_ids: [],
      minutes: 0,
    }));

    // First pass: ensure every must-have requirement is covered
    const coveredReqs = new Set<string>();
    let dayIdx = 0;

    for (const { question } of scored) {
      const reqs = requirements.filter((r) => question.requirement_ids.includes(r.id));
      const hasUncoveredMust = reqs.some(
        (r) => r.priority === "must" && !coveredReqs.has(r.id)
      );

      if (hasUncoveredMust) {
        // Find the earliest day with space
        for (let i = 0; i < daysAvailable; i++) {
          const d = days[i];
          if (d.question_ids.length < 8) {
            d.question_ids.push(question.id);
            reqs.forEach((r) => coveredReqs.add(r.id));
            break;
          }
        }
      }
    }

    // Second pass: distribute remaining questions
    for (const { question } of scored) {
      if (days.some((d) => d.question_ids.includes(question.id))) continue;

      // Find day with fewest questions (load balancing)
      let minDay = days[0];
      for (const d of days) {
        if (d.question_ids.length < minDay.question_ids.length) {
          minDay = d;
        }
      }
      if (minDay.question_ids.length < 10) {
        minDay.question_ids.push(question.id);
      }
    }

    // Calculate minutes per day (base 60 min, +15 per question, cap at 180)
    for (const day of days) {
      const baseMinutes = 60;
      const perQuestion = 15;
      day.minutes = Math.min(baseMinutes + day.question_ids.length * perQuestion, 180);
    }

    // Generate focus for each day
    for (const day of days) {
      const dayQuestions = questions.filter((q) => day.question_ids.includes(q.id));
      const categories = [...new Set(dayQuestions.map((q) => q.category))];
      const reqs = requirements.filter((r) =>
        dayQuestions.some((q) => q.requirement_ids.includes(r.id))
      );
      const mustCount = reqs.filter((r) => r.priority === "must").length;

      if (dayQuestions.length === 0) {
        day.focus = "Review and rest";
      } else if (mustCount > 0) {
        day.focus = `Core requirements: ${categories.join(", ")}`;
      } else {
        day.focus = categories.join(", ") || "Practice";
      }
    }

    return { days_available: daysAvailable, days };
  }
}
