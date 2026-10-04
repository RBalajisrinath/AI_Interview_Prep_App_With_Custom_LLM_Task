import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "No token provided" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = AuthService.verifyToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Invalid or expired token" });
  }
}
