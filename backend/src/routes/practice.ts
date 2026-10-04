import { Router, Request, Response } from "express";
import { PracticeSession } from "../models/PracticeSession";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";

const router = Router();
router.use(authMiddleware);

const recordSchema = z.object({
  kit_id: z.string(),
  card_results: z.array(z.object({
    flashcard_id: z.string(),
    confidence: z.number().int().min(1).max(5),
  })),
});

router.post("/record", async (req: Request, res: Response) => {
  try {
    const { kit_id, card_results } = recordSchema.parse(req.body);
    const now = new Date().toISOString();

    let session = await PracticeSession.findOne({ user_id: req.userId, kit_id });
    if (!session) {
      session = await PracticeSession.create({
        user_id: req.userId,
        kit_id,
        cards: [],
      });
    }

    for (const result of card_results) {
      const existing = session.cards.find((c) => c.flashcard_id === result.flashcard_id);
      if (existing) {
        existing.confidence = result.confidence;
        existing.last_reviewed = now;
        existing.review_count += 1;
      } else {
        session.cards.push({
          flashcard_id: result.flashcard_id,
          confidence: result.confidence,
          last_reviewed: now,
          review_count: 1,
        });
      }
    }

    session.updated_at = now;
    await session.save();
    res.json(session);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: error.errors[0]?.message });
    }
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to record practice" });
  }
});

router.get("/:kitId", async (req: Request, res: Response) => {
  try {
    const session = await PracticeSession.findOne({
      user_id: req.userId,
      kit_id: req.params.kitId,
    });
    res.json(session || { cards: [] });
  } catch (error) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch practice data" });
  }
});

export default router;
