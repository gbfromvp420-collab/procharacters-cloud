import { randomUUID } from "node:crypto";
import { DEFAULT_PROMPT_VERSION } from "../config/constants.js";
import { assertLiveCharacter } from "../lib/live/character-catalog.js";
import { createPromptSnapshot } from "../lib/live/prompt-snapshot.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
import type { ISessionStore } from "../lib/db/session-store.js";
import { InMemorySessionStore } from "../lib/db/session-store.js";
import type {
  CreateSessionInput,
  CreateSessionResult,
  SessionRecord,
} from "../types/session.js";
import { MemoryManager } from "./memory-manager.js";

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionAuthError";
  }
}

export class SessionManager {
  private readonly store: ISessionStore;

  constructor(
    private readonly memory: MemoryManager,
    private readonly defaultCharacterId: string,
    private readonly sessionTtlMinutes: number,
    private readonly maxMessageWindow: number,
    store?: ISessionStore,
  ) {
    this.store = store ?? new InMemorySessionStore();
  }

  async createSession(
    input: CreateSessionInput = {},
    wsBaseUrl: string,
  ): Promise<CreateSessionResult> {
    const characterId = input.characterId ?? this.defaultCharacterId;
    const promptVersion = input.promptVersion ?? DEFAULT_PROMPT_VERSION;

    assertLiveCharacter(characterId);
    const promptSnapshot = await createPromptSnapshot(characterId, promptVersion);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMinutes * 60_000);
    const sessionId = randomUUID();
    const wsToken = randomUUID();

    const record: SessionRecord = {
      id: sessionId,
      characterId: promptSnapshot.characterId,
      promptVersion: promptSnapshot.promptVersion,
      promptSnapshot,
      wsToken,
      status: "active",
      memory: SessionMemory.empty(this.maxMessageWindow).toData(),
      avatarState: this.memory.defaultAvatarState(promptSnapshot.characterId),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.store.set(record);

    const wsUrl = `${wsBaseUrl}/ws/sessions/${sessionId}?token=${wsToken}`;

    return {
      sessionId,
      wsToken,
      characterId: promptSnapshot.characterId,
      promptVersion: promptSnapshot.promptVersion,
      wsUrl,
      avatarState: record.avatarState,
    };
  }

  async getSessionAsync(sessionId: string): Promise<SessionRecord> {
    const session = await this.store.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    this.assertNotExpired(session);
    return session;
  }

  /** Synchronous-compatible getter (for backward compat — uses cache or throws) */
  getSession(sessionId: string): SessionRecord {
    // This is kept for backward compatibility with the WebSocket handler.
    // In practice, the store.get() for InMemorySessionStore is sync-safe.
    // For Redis-backed stores, use getSessionAsync() instead.
    let result: SessionRecord | null = null;
    const store = this.store as { get(id: string): Promise<SessionRecord | null> };

    // For InMemorySessionStore, the promise resolves synchronously
    void store.get(sessionId).then((s) => { result = s; });

    if (!result) {
      throw new SessionNotFoundError(sessionId);
    }
    this.assertNotExpired(result);
    return result;
  }

  authenticate(sessionId: string, token: string): SessionRecord {
    const session = this.getSession(sessionId);
    if (session.wsToken !== token) {
      throw new SessionAuthError("Invalid session token");
    }
    if (session.status !== "active") {
      throw new SessionAuthError("Session is not active");
    }
    return session;
  }

  async authenticateAsync(sessionId: string, token: string): Promise<SessionRecord> {
    const session = await this.getSessionAsync(sessionId);
    if (session.wsToken !== token) {
      throw new SessionAuthError("Invalid session token");
    }
    if (session.status !== "active") {
      throw new SessionAuthError("Session is not active");
    }
    return session;
  }

  updateSession(sessionId: string, patch: Partial<SessionRecord>): SessionRecord {
    const session = this.getSession(sessionId);
    const updated: SessionRecord = {
      ...session,
      ...patch,
      id: session.id,
      promptSnapshot: patch.promptSnapshot ?? session.promptSnapshot,
      memory: patch.memory ?? session.memory,
      updatedAt: new Date().toISOString(),
    };
    void this.store.set(updated);
    return updated;
  }

  endSession(sessionId: string, _reason = "user_ended"): SessionRecord {
    this.getSession(sessionId);
    const cleared = SessionMemory.empty(this.maxMessageWindow).toData();
    return this.updateSession(sessionId, { status: "ended", memory: cleared });
  }

  async listSessions(): Promise<SessionRecord[]> {
    return this.store.list();
  }

  private assertNotExpired(session: SessionRecord): void {
    if (session.status === "ended") {
      return;
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      session.status = "ended";
      void this.store.set(session);
      throw new SessionAuthError("Session expired");
    }
  }
}