/** Roles stored in session memory (chat turns only). */
export type MemoryMessageRole = "user" | "assistant";

/** A single message in the session history. */
export interface MemoryMessage {
  id: string;
  role: MemoryMessageRole;
  content: string;
  createdAt: string;
}

/**
 * Serializable memory state — stored on SessionRecord.
 * Extend this interface later for summaries, facts, or Redis persistence.
 */
export interface SessionMemoryData {
  messages: MemoryMessage[];
}

/** Recent messages returned for prompt injection. */
export interface RecentContext {
  messages: MemoryMessage[];
  messageCount: number;
}