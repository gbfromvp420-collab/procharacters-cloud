/**
 * User service — registration, login, profile management.
 * Uses Postgres when available, falls back to in-memory for dev.
 */
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword, signToken, type JwtPayload } from "./jwt.js";

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  tokens: number;
  role: string;
  createdAt: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_CREDENTIALS" | "USER_EXISTS" | "NOT_FOUND" = "INVALID_CREDENTIALS",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class UserService {
  private readonly inMemoryUsers = new Map<string, UserWithHash>();

  constructor(private readonly pg: pg.Pool | null) {}

  async register(email: string, username: string, password: string, displayName?: string): Promise<{ user: User; token: string }> {
    if (password.length < 6) {
      throw new AuthError("Password must be at least 6 characters", "INVALID_CREDENTIALS");
    }

    const passwordHash = await hashPassword(password);

    if (this.pg) {
      try {
        const result = await this.pg.query<UserWithHash>(
          `INSERT INTO users (email, username, password_hash, display_name)
           VALUES ($1, $2, $3, $4)
           RETURNING id, email, username, display_name as "displayName", tokens, role, created_at as "createdAt"`,
          [email.toLowerCase(), username, passwordHash, displayName ?? username],
        );
        const user = this.stripHash(result.rows[0]);
        const token = signToken({ userId: user.id, email: user.email, role: user.role });
        return { user, token };
      } catch (err: unknown) {
        if ((err as { code?: string }).code === "23505") {
          throw new AuthError("User with this email or username already exists", "USER_EXISTS");
        }
        throw err;
      }
    }

    // In-memory fallback
    const existing = [...this.inMemoryUsers.values()].find(
      (u) => u.email === email.toLowerCase() || u.username === username,
    );
    if (existing) {
      throw new AuthError("User with this email or username already exists", "USER_EXISTS");
    }

    const user: UserWithHash = {
      id: randomUUID(),
      email: email.toLowerCase(),
      username,
      displayName: displayName ?? username,
      passwordHash,
      tokens: 100,
      role: "user",
      createdAt: new Date().toISOString(),
    };
    this.inMemoryUsers.set(user.id, user);

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    return { user: this.stripHash(user), token };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    let userWithHash: UserWithHash | null = null;

    if (this.pg) {
      const result = await this.pg.query<UserWithHash>(
        `SELECT id, email, username, display_name as "displayName", password_hash as "passwordHash", tokens, role, created_at as "createdAt"
         FROM users WHERE email = $1`,
        [email.toLowerCase()],
      );
      userWithHash = result.rows[0] ?? null;
    } else {
      userWithHash = [...this.inMemoryUsers.values()].find((u) => u.email === email.toLowerCase()) ?? null;
    }

    if (!userWithHash) {
      throw new AuthError("Invalid email or password");
    }

    const valid = await verifyPassword(password, userWithHash.passwordHash);
    if (!valid) {
      throw new AuthError("Invalid email or password");
    }

    const user = this.stripHash(userWithHash);
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    return { user, token };
  }

  async getUser(userId: string): Promise<User | null> {
    if (this.pg) {
      const result = await this.pg.query<User>(
        `SELECT id, email, username, display_name as "displayName", tokens, role, created_at as "createdAt"
         FROM users WHERE id = $1`,
        [userId],
      );
      return result.rows[0] ?? null;
    }

    const user = this.inMemoryUsers.get(userId);
    return user ? this.stripHash(user) : null;
  }

  async getUserByToken(jwtPayload: JwtPayload): Promise<User | null> {
    return this.getUser(jwtPayload.userId);
  }

  private stripHash(user: UserWithHash | (User & { passwordHash?: string })): User {
    const { passwordHash: _, ...rest } = user as UserWithHash;
    return rest;
  }
}
