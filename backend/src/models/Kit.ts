import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { Kit } from "../types/kit";

export interface IKit extends Document, Omit<Kit, "id" | "user_id"> {
  id: string;
  user_id: string;
}

const requirementSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  kind: { type: String, enum: ["technical", "behavioural", "domain"], required: true },
  priority: { type: String, enum: ["must", "nice"], required: true },
}, { _id: false });

const questionSchema = new Schema({
  id: { type: String, required: true },
  requirement_ids: [{ type: String }],
  category: { type: String, enum: ["technical", "behavioural", "system-design", "company-fit"], required: true },
  prompt: { type: String, required: true },
  answer_outline: { type: String, required: true },
  difficulty: { type: Number, min: 1, max: 3, required: true },
  origin: { type: String, enum: ["generated", "edited", "pinned"], default: "generated" },
}, { _id: false });

const flashcardSchema = new Schema({
  id: { type: String, required: true },
  front: { type: String, required: true },
  back: { type: String, required: true },
  requirement_ids: [{ type: String }],
  origin: { type: String, enum: ["generated", "edited", "pinned"], default: "generated" },
}, { _id: false });

const scheduleDaySchema = new Schema({
  day: { type: Number, required: true },
  focus: { type: String, required: true },
  question_ids: [{ type: String }],
  minutes: { type: Number, required: true },
}, { _id: false });

const kitSchema = new Schema<IKit>({
  id: { type: String, default: uuidv4, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  source: {
    company: String,
    company_url: String,
    role: String,
    location: String,
    jd_chars: Number,
    researched_at: String,
    pages_used: [String],
    jd: String,
  },
  company_brief: {
    summary: String,
    what_they_do: String,
    sources: [String],
  },
  role: {
    title: String,
    seniority: String,
    responsibilities: [String],
    requirements: [requirementSchema],
  },
  questions: [questionSchema],
  flashcards: [flashcardSchema],
  schedule: {
    days_available: Number,
    days: [scheduleDaySchema],
  },
  coverage: {
    uncovered_requirement_ids: [String],
    passes: Number,
  },
  status: { type: String, enum: ["draft", "generating", "ready", "failed"], default: "draft" },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() },
});

export const KitModel = mongoose.model<IKit>("Kit", kitSchema);
