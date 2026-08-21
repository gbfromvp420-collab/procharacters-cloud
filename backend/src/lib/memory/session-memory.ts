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

  /** Merge / refresh opt-in dossier (e.g. on resume from CharacterSession). */
  setPriorNotes(notes: string | undefined | null): void {
    const trimmed = notes?.trim();
    this.priorNotes = trimmed ? trimmed.slice(0, 1600) : undefined;
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

  /**
   * On resume/reload: rebuild compact notes if missing and return a scene
   * continuity blurb so the first post-restore turn rehydrates hard.
   */
  ensureResumeContinuity(options?: {
    characterName?: string;
    characterId?: string;
    sessionNotesBuilder?: (messages: MemoryMessage[]) => string;
  }): {
    rehydrated: boolean;
    sessionNotes?: string;
    sceneLock: string;
    lastUserAction?: string;
    turnCount: number;
  } {
    const turnCount = Math.floor(this.messages.length / 2);
    const lastUser = [...this.messages].reverse().find((m) => m.role === "user");
    const sceneLock = extractSceneLock(this.messages, options?.characterId);

    if (!this.sessionNotes?.trim() && this.messages.length > 0 && options?.sessionNotesBuilder) {
      this.sessionNotes =
        options.sessionNotesBuilder(this.messages).trim().slice(0, 1200) || undefined;
    }

    return {
      rehydrated: this.messages.length > 0,
      sessionNotes: this.sessionNotes,
      sceneLock,
      lastUserAction: lastUser?.content,
      turnCount,
    };
  }

  /**
   * In-session kink tags (ephemeral). Durable kink lives on CharacterSession
   * via character-session-store (Prisma) when opt-in cross-session saves.
   */
  getKinkProfile(): Record<string, unknown> {
    return {};
  }
}

/**
 * Heuristic scene lock for resume + mid-session stickiness.
 * clothing / pose / act / arousal / game (+ optional call name).
 */
export function extractSceneLock(messages: MemoryMessage[], characterId?: string): string {
  const recent = messages.slice(-16);
  const corpus = recent.map((m) => m.content.toLowerCase()).join(" ");
  const rawCorpus = recent.map((m) => m.content).join(" ");

  const clothing = /crotchless|open panel|open-panel/.test(corpus)
    ? "crotchless open"
    : /sheer|thong|g-string|mesh/.test(corpus)
      ? "sheer signature on"
      : /lace|lingerie|panties|undies/.test(corpus)
        ? "lingerie / signature bottoms"
        : characterId?.includes("female") || characterId?.includes("brat")
          ? "crotchless open"
          : "signature clothing on";

  const pose = /on (?:my |your )?back|lying back|on_back/.test(corpus)
    ? "on back"
    : /kneel|on (?:my |your )?knees/.test(corpus)
      ? "kneeling"
      : /straddl|on (?:my |your )?lap|riding/.test(corpus)
        ? "straddling / close"
        : /lean(?:ing)? in|close.?up|face.?to.?face|inches? away/.test(corpus)
          ? "close / leaning in"
          : /mirror|watching (?:myself|yourself)/.test(corpus)
            ? "mirror view"
            : /standing|against the wall/.test(corpus)
              ? "standing"
              : "live cam presence";

  const act = /handjob|stroke|stroking|palm|grip|fist/.test(corpus)
    ? "hands-on stroke / grip"
    : /french kiss|tongue|making out|kiss(?:ing)?/.test(corpus)
      ? "kissing / mouth heat"
      : /grind|hip.?roll|rub(?:bing)? against/.test(corpus)
        ? "grinding / friction"
        : /hover|tease over|over.?fabric|through (?:the )?fabric/.test(corpus)
          ? "over-fabric tease"
          : /edge|edging|hold it|don't cum|dont cum/.test(corpus)
            ? "edging hold"
            : /look(?:ing)? at|eye contact|watch me/.test(corpus)
              ? "eye contact / show-off"
              : "tease / escalate";

  let arousal = "warm / building";
  if (
    /so close|almost there|right on the edge|can't hold|cant hold|about to|gonna cum|going to cum/.test(
      corpus,
    )
  ) {
    arousal = "peak · denial hold";
  } else if (/edge|edging|hold it|don't cum|dont cum|denial|not yet|no finish/.test(corpus)) {
    arousal = "high · edging / denial active";
  } else if (/wet|hard|throbbing|dripping|moan|puffy|swollen|leaking|precum/.test(corpus)) {
    arousal = "visibly aroused";
  } else if (/calm|soft|afterglow|come.?down|breathing/.test(corpus) && recent.length >= 4) {
    arousal = "soft / afterglow pocket";
  }

  const game = /edge|deny|denial|count|beg|please|no finish|not yet|hold it/.test(corpus)
    ? "ongoing edging/denial game"
    : /praise|good boy|good girl|so good/.test(corpus)
      ? "praise / soft-dom loop"
      : "tease / escalate in-character";

  const calledRaw =
    rawCorpus.match(
      /(?:call(?:ed)? me|my name(?:'s| is)|i(?:'m| am))\s+([A-Za-z][A-Za-z-]{1,18})/i,
    )?.[1] ?? null;
  const called = calledRaw?.replace(/[.\s,!?]+$/g, "") || null;

  const parts = [
    `clothing="${clothing}"`,
    `pose=${pose}`,
    `act=${act}`,
    `arousal=${arousal}`,
    `game=${game}`,
  ];
  if (called) parts.push(`called=${called}`);

  return parts.join("; ");
}
