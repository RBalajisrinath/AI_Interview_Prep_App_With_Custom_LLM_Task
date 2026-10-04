import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export interface IUser extends Document {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  id: { type: String, default: uuidv4, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  created_at: { type: String, default: () => new Date().toISOString() },
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password_hash);
};

userSchema.statics.hashPassword = async function (password: string): Promise<string> {
  return bcrypt.hash(password, 12);
};

export const User = mongoose.model<IUser>("User", userSchema);
