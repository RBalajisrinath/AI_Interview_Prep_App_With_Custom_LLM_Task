import { Router, Request, Response } from "express";
import { KitService } from "../services/kit";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";

const router = Router();
router.use(authMiddleware);

const createKitSchema = z.object({
  jd: z.string().min(10),
  company_url: z.string().url(),
  days: z.number().int().min(1).max(60),
  company: z.string().optional(),
  role: z.string().optional(),
  location: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const input = createKitSchema.parse(req.body);
    const kit = await KitService.createKit(req.userId!, input);
    res.status(201).json(kit);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: error.errors[0]?.message });
    }
    console.error("[Kit] Create error:", error);
    if (error.code === "PROVIDER_OUT_OF_SPACE") {
      return res.status(503).json({
        error: "LLM_UNAVAILABLE",
        message: "The AI provider is temporarily unavailable. Please try again later.",
      });
    }
    res.status(500).json({ error: "GENERATION_FAILED", message: error.message || "Failed to generate kit" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const kits = await KitService.getUserKits(req.userId!);
    res.json(kits);
  } catch (error) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch kits" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const kit = await KitService.getKit(req.userId!, req.params.id as string);
    if (!kit) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Kit not found" });
    }
    res.json(kit);
  } catch (error) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to fetch kit" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const kit = await KitService.updateKit(req.userId!, req.params.id as string, req.body);
    if (!kit) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Kit not found" });
    }
    res.json(kit);
  } catch (error) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to update kit" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await KitService.deleteKit(req.userId!, req.params.id as string);
    if (!deleted) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Kit not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to delete kit" });
  }
});

router.post("/:id/regenerate/:section", async (req: Request, res: Response) => {
  try {
    const section = req.params.section as string;
    if (!["company_brief", "questions", "schedule", "flashcards"].includes(section)) {
      return res.status(400).json({ error: "INVALID_SECTION", message: "Invalid section" });
    }
    const kit = await KitService.regenerateSection(
      req.userId!,
      req.params.id as string,
      section as "company_brief" | "questions" | "schedule" | "flashcards"
    );
    if (!kit) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Kit not found" });
    }
    res.json(kit);
  } catch (error: any) {
    console.error("[Kit] Regenerate error:", error);
    res.status(500).json({ error: "REGENERATION_FAILED", message: error.message });
  }
});

export default router;
