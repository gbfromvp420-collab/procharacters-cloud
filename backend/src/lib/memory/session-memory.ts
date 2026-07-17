import { randomUUID } from "node:crypto";
import type {
  MemoryMessage,
  MemoryMessageRole,
  RecentContext,
  SessionMemoryData,
} from "./types.js";

const DEFAULT_MAX_WINDOW = 30;

/**
 * Lightweight in-session memory for v2 live chat.
 *
 * Stores recent user/assistant messages only. No summarization or fact extraction.
 * Cleared when the session ends (or call clear() explicitly).
 */
export class SessionMemory {
  private messages: MemoryMessage[];
  private sessionNotes?: string;
  private priorNotes?: string;

  constructor(
    private readonly maxWindow: number = DEFAULT_MAX_WINDOW,
    initialMessages: MemoryMessage[] = [],
    meta?: { sessionNotes?: string; priorNotes?: string },
  ) {
    this.messages = [...initialMessages];
    this.sessionNotes = meta?.sessionNotes;
    this.priorNotes = meta?.priorNotes;
  }

  /** Start a new empty memory store. */
  static empty(
    maxWindow = DEFAULT_MAX_WINDOW,
    meta?: { priorNotes?: string; sessionNotes?: string },
  ): SessionMemory {
    return new SessionMemory(maxWindow, [], meta);
  }

  /** Restore memory from session state. */
  static fromData(data: SessionMemoryData, maxWindow = DEFAULT_MAX_WINDOW): SessionMemory {
    const window = data.messageWindow && data.messageWindow > 0 ? data.messageWindow : maxWindow;
    return new SessionMemory(window, data.messages, {
      sessionNotes: data.sessionNotes,
      priorNotes: data.priorNotes,
    });
  }

  /** Serialize for storage on SessionRecord. */
  toData(): SessionMemoryData {
    return {
      messages: [...this.messages],
      messageWindow: this.maxWindow,
      ...(this.sessionNotes ? { sessionNotes: this.sessionNotes } : {}),
      ...(this.priorNotes ? { priorNotes: this.priorNotes } : {}),
    };
  }

  setSessionNotes(notes: string): void {
    this.sessionNotes = notes.trim().slice(0, 1200) || undefined;
  }

  getSessionNotes(): string | undefined {
    return this.sessionNotes;
  }

  getPriorNotes(): string | undefined {
    return this.priorNotes;
  }

  getMaxWindow(): number {
    return this.maxWindow;
  }

  /** Add one message and trim to the window size. */
  addMessage(role: MemoryMessageRole, content: string): MemoryMessage {
    const message: MemoryMessage = {
      id: randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString(),
    };

    this.messages.push(message);

    if (this.messages.length > this.maxWindow) {
      this.messages = this.messages.slice(-this.maxWindow);
    }

    return message;
  }

  /** Convenience: record a full user → assistant turn. */
  addTurn(userContent: string, assistantContent: string): void {
    this.addMessage("user", userContent);
    this.addMessage("assistant", assistantContent);
  }

  /** Get recent messages for prompt injection (defaults to full window). */
  getRecentContext(limit = this.maxWindow): RecentContext {
    return {
      messages: this.messages.slice(-limit),
      messageCount: this.messages.length,
      ...(this.sessionNotes ? { sessionNotes: this.sessionNotes } : {}),
      ...(this.priorNotes ? { priorNotes: this.priorNotes } : {}),
    };
  }

  /** Wipe all session memory. */
  clear(): void {
    this.messages = [];
  }

  // Naughty Syntax Unchained Extension
  getKinkProfile() {
    // TODO: load from character-memory store
    return {};
  }

  updateKinkProfile(newProfile: any) {
    // Merge into persistent store
    console.log("[Naughty Syntax] Kink profile evolving:", newProfile);
  }

  // Bridge to our JSON persistent store
  loadPersistentMemory(characterId: string, userId: string = "default") {
    // TODO: import and call character-memory.js helpers here (or convert to TS)
    console.log(`[Naughty Syntax] Loading persistent memory for ${characterId}`);
  }
}