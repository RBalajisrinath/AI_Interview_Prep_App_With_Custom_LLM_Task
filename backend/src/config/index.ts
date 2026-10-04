import dotenv from "dotenv";
import path from "path";

// Load .env from project root (parent of backend dir)
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/interview-prep",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  llmProvider: process.env.LLM_PROVIDER || "ollama",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.2:1b",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "openai-fast",
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  maxPagesPerCrawl: parseInt(process.env.MAX_PAGES_PER_CRAWL || "15", 10),
  crawlTimeoutMs: parseInt(process.env.CRAWL_TIMEOUT_MS || "10000", 10),
  llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10),
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || "30", 10),
};
