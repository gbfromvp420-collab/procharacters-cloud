import { randomUUID } from "node:crypto";
import { DEFAULT_PROMPT_VERSION } from "../config/constants.js";
import { assertLiveCharacter } from "../lib/live/character-catalog.js";
import { createPromptSnapshot } from "../lib/live/prompt-snapshot.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
import {
  loadSessionRecord,
  saveSessionRecord,
} from "../lib/memory/session-store.js";
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
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(
    private readonly memory: MemoryManager,
    private readonly defaultCharacterId: string,
    private readonly sessionTtlMinutes: number,
    private readonly maxMessageWindow: number,
  ) {}

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

    this.sessions.set(sessionId, record);
    await this.persist(record);

    return this.toCreateResult(record, wsBaseUrl);
  }

  /**
   * Resume a previous chat: keep transcript + character, mint a new ws token,
   * reactivate, and extend TTL. Works for ended sessions that still have memory.
   */
  async resumeSession(
    sessionId: string,
    token: string,
    wsBaseUrl: string,
  ): Promise<CreateSessionResult & { messages: SessionRecord["memory"]["messages"] }> {
    const session = await this.loadSession(sessionId);
    if (session.wsToken !== token) {
      throw new SessionAuthError("Invalid session token");
    }

    const now = new Date();
    const hardExpiry = new Date(session.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000;
    if (hardExpiry < now.getTime()) {
      throw new SessionAuthError("Session archive expired (14 day limit)");
    }

    // Re-assert character still exists (custom may have been deleted).
    assertLiveCharacter(session.characterId);

    const updated: SessionRecord = {
      ...session,
      wsToken: randomUUID(),
      status: "active",
      expiresAt: new Date(now.getTime() + this.sessionTtlMinutes * 60_000).toISOString(),
      updatedAt: now.toISOString(),
    };

    this.sessions.set(sessionId, updated);
    await this.persist(updated);

    return {
      ...this.toCreateResult(updated, wsBaseUrl),
      messages: updated.memory.messages ?? [],
    };
  }

  getSession(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    this.assertNotExpired(session);
    return session;
  }

  /** Sync get that also hydrates from disk when missing (used by routes). */
  async getSessionAsync(sessionId: string): Promise<SessionRecord> {
    const session = await this.loadSession(sessionId);
    this.assertNotExpired(session);
    return session;
  }

  authenticate(sessionId: string, token: string): SessionRecord {
    // Prefer sync path for WS; hydrate must happen before connect via resume/create.
    let session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    this.assertNotExpired(session);
    if (session.wsToken !== token) {
      throw new SessionAuthError("Invalid session token");
    }
    if (session.status !== "active") {
      throw new SessionAuthError("Session is not active — resume it first");
    }
    return session;
  }

  /** Async authenticate that can load from disk (HTTP routes / WS). */
  async authenticateAsync(
    sessionId: string,
    token: string,
    options: { requireActive?: boolean } = {},
  ): Promise<SessionRecord> {
    const requireActive = options.requireActive !== false;
    const session = await this.loadSession(sessionId);
    if (session.wsToken !== token) {
      throw new SessionAuthError("Invalid session token");
    }
    this.assertNotExpired(session);
    if (requireActive && session.status !== "active") {
      throw new SessionAuthError("Session is not active — resume it first");
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
    this.sessions.set(sessionId, updated);
    void this.persist(updated);
    return updated;
  }

  endSession(sessionId: string, _reason = "user_ended"): SessionRecord {
    const session = this.getSession(sessionId);
    // Keep transcript for cross-visit resume — do not wipe memory.
    const updated = this.updateSession(sessionId, { status: "ended" });
    void this.persist(updated);
    return updated;
  }

  listSessions(): SessionRecord[] {
    return [...this.sessions.values()];
  }

  private async loadSession(sessionId: string): Promise<SessionRecord> {
    const cached = this.sessions.get(sessionId);
    if (cached) return cached;

    const fromDisk = await loadSessionRecord(sessionId);
    if (!fromDisk) {
      throw new SessionNotFoundError(sessionId);
    }
    this.sessions.set(sessionId, fromDisk);
    return fromDisk;
  }

  private async persist(record: SessionRecord): Promise<void> {
    try {
      await saveSessionRecord(record);
    } catch (error) {
      console.error(`[session-store] persist failed for ${record.id}:`, error);
    }
  }

  private toCreateResult(record: SessionRecord, wsBaseUrl: string): CreateSessionResult {
    return {
      sessionId: record.id,
      wsToken: record.wsToken,
      characterId: record.characterId,
      promptVersion: record.promptVersion,
      wsUrl: `${wsBaseUrl}/ws/sessions/${record.id}?token=${record.wsToken}`,
      avatarState: record.avatarState,
    };
  }

  private assertNotExpired(session: SessionRecord): void {
    if (session.status === "ended") {
      return;
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      session.status = "ended";
      this.sessions.set(session.id, session);
      void this.persist(session);
      // Allow callers that only need the archive (resume) to still load the record;
      // active-path callers check status separately.
    }
  }
}
