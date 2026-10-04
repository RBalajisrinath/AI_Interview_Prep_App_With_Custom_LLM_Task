import { Requirement, Question } from "../types/kit";

export class CoverageService {
  /**
   * Deterministically check which requirements have no questions covering them.
   * This is code's decision, not the model's.
   */
  static findGaps(requirements: Requirement[], questions: Question[]): string[] {
    const covered = new Set<string>();
    for (const q of questions) {
      for (const reqId of q.requirement_ids) {
        covered.add(reqId);
      }
    }
    return requirements
      .filter((r) => !covered.has(r.id))
      .map((r) => r.id);
  }

  /**
   * Check if all must-have requirements are covered.
   */
  static isComplete(requirements: Requirement[], questions: Question[]): boolean {
    const mustReqs = requirements.filter((r) => r.priority === "must");
    return this.findGaps(mustReqs, questions).length === 0;
  }
}
