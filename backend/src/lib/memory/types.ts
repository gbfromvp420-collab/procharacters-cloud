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
  /** Compact "what we remember" blurb for prompts + UI. */
  sessionNotes?: string;
  /** Optional seed from prior sessions (signed-in opt-in). */
  priorNotes?: string;
  /** Effective message window for this session. */
  messageWindow?: number;
}

/** Recent messages returned for prompt injection. */
export interface RecentContext {
  messages: MemoryMessage[];
  messageCount: number;
  sessionNotes?: string;
  priorNotes?: string;
}
