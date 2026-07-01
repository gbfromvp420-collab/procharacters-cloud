/**
 * Authentication utilities — JWT + bcrypt based user auth.
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = "7d";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Dev fallback — NEVER use in production
    if (process.env.NODE_ENV === "development") {
      return "dev-secret-do-not-use-in-production";
    }
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}
