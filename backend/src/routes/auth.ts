import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const { user, token } = await AuthService.register(email, password, name);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error: any) {
    if (error.message === "EMAIL_EXISTS") {
      return res.status(409).json({ error: "EMAIL_EXISTS", message: "Email already registered" });
    }
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: error.errors[0]?.message });
    }
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Registration failed" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { user, token } = await AuthService.login(email, password);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error: any) {
    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    }
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: error.errors[0]?.message });
    }
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Login failed" });
  }
});

router.post("/logout", authMiddleware, (_req: Request, res: Response) => {
  // JWT is stateless; client discards token
  res.json({ success: true });
});

router.get("/me", authMiddleware, (req: Request, res: Response) => {
  res.json({ user: { id: req.userId, email: req.userEmail } });
});

export default router;
