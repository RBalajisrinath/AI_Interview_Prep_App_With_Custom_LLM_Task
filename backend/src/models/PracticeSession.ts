import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IPracticeSession extends Document {
  id: string;
  user_id: string;
  kit_id: string;
  cards: {
    flashcard_id: string;
    confidence: number;
    last_reviewed: string;
    review_count: number;
  }[];
  created_at: string;
  updated_at: string;
}

const practiceCardSchema = new Schema({
  flashcard_id: { type: String, required: true },
  confidence: { type: Number, min: 1, max: 5, required: true },
  last_reviewed: { type: String, required: true },
  review_count: { type: Number, default: 1 },
}, { _id: false });

const practiceSessionSchema = new Schema<IPracticeSession>({
  id: { type: String, default: uuidv4, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  kit_id: { type: String, required: true, index: true },
  cards: [practiceCardSchema],
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() },
});

export const PracticeSession = mongoose.model<IPracticeSession>("PracticeSession", practiceSessionSchema);
