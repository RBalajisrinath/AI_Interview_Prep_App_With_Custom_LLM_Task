import mongoose from "mongoose";
import { config } from "../config";
import { KitService } from "../services/kit";
import { BatchCase, BatchOutput, BatchResult } from "../types/kit";
import * as fs from "fs";
import * as path from "path";

/**
 * Batch entry point: npm run evaluate -- --input <cases.json> --output <kits.json>
 * Reads an array of cases, runs the full pipeline on each, writes results to a file.
 */
async function evaluate() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const outputIdx = args.indexOf("--output");

  if (inputIdx === -1 || outputIdx === -1) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  // Resolve paths relative to the project root (parent of server dir)
  const projectRoot = path.resolve(__dirname, "..", "..");
  const inputPath = path.isAbsolute(args[inputIdx + 1])
    ? args[inputIdx + 1]
    : path.resolve(projectRoot, args[inputIdx + 1]);
  const outputPath = path.isAbsolute(args[outputIdx + 1])
    ? args[outputIdx + 1]
    : path.resolve(projectRoot, args[outputIdx + 1]);

  console.log(`[Batch] Reading cases from ${inputPath}`);
  const cases: BatchCase[] = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  console.log(`[Batch] Processing ${cases.length} cases...`);

  await mongoose.connect(config.mongoUri);
  console.log("[Batch] Connected to MongoDB");

  const results: BatchResult[] = [];

  for (const testCase of cases) {
    console.log(`\n[Batch] Processing case: ${testCase.id}`);
    const startTime = Date.now();

    try {
      // Use a system user ID for batch processing
      const kit = await KitService.createKit("batch-user", {
        jd: testCase.jd,
        company_url: testCase.company_url,
        days: testCase.days,
      });

      const elapsed = Date.now() - startTime;
      console.log(`[Batch] Case ${testCase.id} completed in ${elapsed}ms`);

      results.push({
        id: testCase.id,
        status: "ok",
        kit,
        error: null,
      });
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Batch] Case ${testCase.id} failed after ${elapsed}ms:`, error.message);

      results.push({
        id: testCase.id,
        status: "failed",
        kit: null,
        error: {
          code: error.message || "GENERATION_FAILED",
          message: error.message || "Failed to generate kit",
        },
      });
    }
  }

  const output: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n[Batch] Results written to ${outputPath}`);
  console.log(`[Batch] ${results.filter((r) => r.status === "ok").length}/${results.length} cases succeeded`);

  await mongoose.disconnect();
  process.exit(0);
}

evaluate().catch((error) => {
  console.error("[Batch] Fatal error:", error);
  process.exit(1);
});
