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

  constructor(
    private readonly maxWindow: number = DEFAULT_MAX_WINDOW,
    initialMessages: MemoryMessage[] = [],
  ) {
    this.messages = [...initialMessages];
  }

  /** Start a new empty memory store. */
  static empty(maxWindow = DEFAULT_MAX_WINDOW): SessionMemory {
    return new SessionMemory(maxWindow);
  }

  /** Restore memory from session state. */
  static fromData(data: SessionMemoryData, maxWindow = DEFAULT_MAX_WINDOW): SessionMemory {
    return new SessionMemory(maxWindow, data.messages);
  }

  /** Serialize for storage on SessionRecord. */
  toData(): SessionMemoryData {
    return { messages: [...this.messages] };
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
    };
  }

  /** Wipe all session memory. */
  clear(): void {
    this.messages = [];
  }
}