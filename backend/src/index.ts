import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import authRoutes from "./routes/auth";
import kitRoutes from "./routes/kits";
import practiceRoutes from "./routes/practice";

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimitPerMinute,
  message: { error: "RATE_LIMITED", message: "Too many requests, please slow down" },
});
app.use("/api/", limiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/kits", kitRoutes);
app.use("/api/practice", practiceRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server] Unhandled error:", err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: "Something went wrong" });
});

let server: ReturnType<typeof app.listen> | undefined;
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] Shutting down (${signal})`);

  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });

  await mongoose.disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function start() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("[Server] Connected to MongoDB");

    server = app.listen(config.port, () => {
      console.log(`[Server] Running on port ${config.port}`);
    });
    server.on("error", (error) => {
      console.error("[Server] Failed to listen:", error);
      void shutdown("listen error");
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

start();
