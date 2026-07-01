/**
 * Session store abstraction — pluggable backends.
 * Falls back to in-memory if Redis/Postgres are not configured.
 */
import type { RedisClient } from "./redis.js";
import type pg from "pg";
import type { SessionRecord } from "../../types/session.js";

export interface ISessionStore {
  get(sessionId: string): Promise<SessionRecord | null>;
  set(session: SessionRecord): Promise<void>;
  delete(sessionId: string): Promise<void>;
  list(): Promise<SessionRecord[]>;
}

/* ── In-memory store (default / dev fallback) ──────────── */

export class InMemorySessionStore implements ISessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  async get(sessionId: string): Promise<SessionRecord | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async set(session: SessionRecord): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async list(): Promise<SessionRecord[]> {
    return [...this.sessions.values()];
  }
}

/* ── Redis-backed store (sessions cached in Redis, persisted to Postgres) ── */

const SESSION_PREFIX = "session:";
const SESSION_TTL = 7200; // 2 hours in seconds

export class RedisSessionStore implements ISessionStore {
  constructor(
    private readonly redis: RedisClient,
    private readonly pg: pg.Pool | null,
  ) {}

  async get(sessionId: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(`${SESSION_PREFIX}${sessionId}`);
    if (raw) return JSON.parse(raw) as SessionRecord;

    // Fallback to Postgres if not in Redis cache
    if (this.pg) {
      const result = await this.pg.query<{ data: SessionRecord }>(
        "SELECT data FROM sessions WHERE id = $1",
        [sessionId],
      );
      if (result.rows[0]) {
        const session = result.rows[0].data;
        // Re-cache in Redis
        await this.redis.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL, JSON.stringify(session));
        return session;
      }
    }

    return null;
  }

  async set(session: SessionRecord): Promise<void> {
    const json = JSON.stringify(session);
    await this.redis.setex(`${SESSION_PREFIX}${session.id}`, SESSION_TTL, json);

    // Persist to Postgres
    if (this.pg) {
      await this.pg.query(
        `INSERT INTO sessions (id, character_id, user_id, status, data, created_at, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           data = EXCLUDED.data,
           updated_at = EXCLUDED.updated_at`,
        [
          session.id,
          session.characterId,
          (session as SessionRecord & { userId?: string }).userId ?? null,
          session.status,
          json,
          session.createdAt,
          session.updatedAt,
          session.expiresAt,
        ],
      );
    }
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(`${SESSION_PREFIX}${sessionId}`);
  }

  async list(): Promise<SessionRecord[]> {
    if (this.pg) {
      const result = await this.pg.query<{ data: SessionRecord }>(
        "SELECT data FROM sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 100",
      );
      return result.rows.map((r) => r.data);
    }

    // Scan Redis keys (fallback)
    const keys = await this.redis.keys(`${SESSION_PREFIX}*`);
    const sessions: SessionRecord[] = [];
    for (const key of keys) {
      const raw = await this.redis.get(key);
      if (raw) sessions.push(JSON.parse(raw) as SessionRecord);
    }
    return sessions;
  }
}

/* ── Factory ───────────────────────────────────────────── */

export function createSessionStore(redis: RedisClient | null, pg: pg.Pool | null): ISessionStore {
  if (redis) {
    return new RedisSessionStore(redis, pg);
  }
  return new InMemorySessionStore();
}
