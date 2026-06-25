import { randomUUID } from "node:crypto";
import { DEFAULT_PROMPT_VERSION } from "../config/constants.js";
import { assertLiveCharacter } from "../lib/live/character-catalog.js";
import { createPromptSnapshot } from "../lib/live/prompt-snapshot.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
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

    const wsUrl = `${wsBaseUrl}/ws/sessions/${sessionId}?token=${wsToken}`;

    return {
      sessionId,
      wsToken,
      characterId: promptSnapshot.characterId,
      promptVersion: promptSnapshot.promptVersion,
      wsUrl,
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
    return updated;
  }

  endSession(sessionId: string, _reason = "user_ended"): SessionRecord {
    this.getSession(sessionId);
    const cleared = SessionMemory.empty(this.maxMessageWindow).toData();
    return this.updateSession(sessionId, { status: "ended", memory: cleared });
  }

  listSessions(): SessionRecord[] {
    return [...this.sessions.values()];
  }

  private assertNotExpired(session: SessionRecord): void {
    if (session.status === "ended") {
      return;
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      session.status = "ended";
      this.sessions.set(session.id, session);
      throw new SessionAuthError("Session expired");
    }
  }
}