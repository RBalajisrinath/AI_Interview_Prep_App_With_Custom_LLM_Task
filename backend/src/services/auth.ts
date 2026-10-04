import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User";
import { config } from "../config";
import { AuthTokenPayload } from "../types";
import bcrypt from "bcryptjs";

export class AuthService {
  static async register(email: string, password: string, name: string): Promise<{ user: IUser; token: string }> {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new Error("EMAIL_EXISTS");
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      password_hash,
      name,
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  static async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  static generateToken(user: IUser): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
    };
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
  }

  static verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
    } catch {
      throw new Error("INVALID_TOKEN");
    }
  }
}
