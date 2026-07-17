/**
 * CharacterSession — durable per-account + character memory in Postgres.
 *
 * Complements file-based cross-session notes:
 * - notes / dossier still live in cross-session-notes.json (opt-in gate)
 * - CharacterSession holds memorySummary, kinkProfile, recent history slice
 *
 * No-ops cleanly when DATABASE_URL is unset (local JSON-only mode).
 */
import { prisma } from "../prisma.js";
import type { MemoryMessage } from "./types.js";
import {
  evolveKinkProfile,
  formatKinkProfileLine,
  type KinkProfile,
} from "./kink-profile.js";

const MAX_HISTORY = 40;
const MAX_SUMMARY = 1600;

export type CharacterSessionRecord = {
  id: string;
  characterId: string;
  userId: string;
  memorySummary: string | null;
  kinkProfile: KinkProfile | null;
  history: MemoryMessage[];
  messageCount: number;
  lastSessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isCharacterSessionDbConfigured(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

function asKinkProfile(value: unknown): KinkProfile | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<KinkProfile>;
  return {
    tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === "string") : [],
    intensity:
      v.intensity === "soft" ||
      v.intensity === "medium" ||
      v.intensity === "high" ||
      v.intensity === "edge"
        ? v.intensity
        : "medium",
    notes: Array.isArray(v.notes) ? v.notes.filter((n): n is string => typeof n === "string") : [],
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
  };
}

function asHistory(value: unknown): MemoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is MemoryMessage => {
      if (!m || typeof m !== "object") return false;
      const row = m as MemoryMessage;
      return (
        (row.role === "user" || row.role === "assistant") &&
        typeof row.content === "string" &&
        typeof row.id === "string"
      );
    })
    .slice(-MAX_HISTORY);
}

function mapRow(row: {
  id: string;
  characterId: string;
  userId: string | null;
  memorySummary: string | null;
  kinkProfile: unknown;
  history: unknown;
  messageCount?: number | null;
  lastSessionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CharacterSessionRecord | null {
  if (!row.userId) return null;
  return {
    id: row.id,
    characterId: row.characterId,
    userId: row.userId,
    memorySummary: row.memorySummary,
    kinkProfile: asKinkProfile(row.kinkProfile),
    history: asHistory(row.history),
    messageCount: typeof row.messageCount === "number" ? row.messageCount : 0,
    lastSessionId: row.lastSessionId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Load durable character memory for an account (if any). */
export async function getCharacterSession(
  userId: string,
  characterId: string,
): Promise<CharacterSessionRecord | null> {
  if (!isCharacterSessionDbConfigured() || !userId?.trim() || !characterId?.trim()) {
    return null;
  }
  try {
    const row = await prisma.characterSession.findUnique({
      where: {
        userId_characterId: {
          userId: userId.trim(),
          characterId: characterId.trim(),
        },
      },
    });
    if (!row) return null;
    return mapRow(row);
  } catch (error) {
    console.error("[character-session] get failed:", error);
    return null;
  }
}

export type UpsertCharacterSessionInput = {
  userId: string;
  characterId: string;
  /** Dossier / summary text (already opt-in gated by caller). */
  memorySummary?: string;
  messages?: MemoryMessage[];
  messageCountHint?: number;
  lastSessionId?: string;
  /** When true, merge kink profile from messages. Default true. */
  evolveKinks?: boolean;
};

/**
 * Upsert CharacterSession after a chat turn (or session end).
 * Caller must enforce opt-in — we only persist what we're given.
 */
export async function upsertCharacterSession(
  input: UpsertCharacterSessionInput,
): Promise<CharacterSessionRecord | null> {
  if (!isCharacterSessionDbConfigured()) return null;
  const userId = input.userId?.trim();
  const characterId = input.characterId?.trim();
  if (!userId || !characterId) return null;

  try {
    const existing = await prisma.characterSession.findUnique({
      where: { userId_characterId: { userId, characterId } },
    });

    const priorKink = asKinkProfile(existing?.kinkProfile);
    const priorHistory = asHistory(existing?.history);
    const incoming = (input.messages ?? []).slice(-MAX_HISTORY);
    const history = [...priorHistory, ...incoming]
      .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
      .slice(-MAX_HISTORY);

    const kinkProfile =
      input.evolveKinks === false
        ? priorKink
        : evolveKinkProfile(incoming.length ? incoming : history, priorKink);

    const summary =
      (input.memorySummary?.trim() || existing?.memorySummary || "").slice(0, MAX_SUMMARY) ||
      null;

    const messageCount =
      input.messageCountHint ??
      (typeof existing?.messageCount === "number"
        ? Math.max(existing.messageCount, history.length)
        : history.length);

    const historyJson = history as unknown as object;
    const kinkJson = (kinkProfile ?? undefined) as unknown as object | undefined;

    const row = await prisma.characterSession.upsert({
      where: { userId_characterId: { userId, characterId } },
      create: {
        userId,
        characterId,
        memorySummary: summary,
        kinkProfile: kinkJson,
        history: historyJson,
        messageCount,
        lastSessionId: input.lastSessionId ?? null,
      },
      update: {
        memorySummary: summary,
        kinkProfile: kinkJson,
        history: historyJson,
        messageCount,
        ...(input.lastSessionId ? { lastSessionId: input.lastSessionId } : {}),
      },
    });

    return mapRow(row);
  } catch (error) {
    console.error("[character-session] upsert failed:", error);
    return null;
  }
}

/**
 * Build prior-notes seed for a new session from Prisma row.
 * Combines memorySummary + compact kink line.
 */
export function priorNotesFromCharacterSession(
  record: CharacterSessionRecord | null | undefined,
): string | null {
  if (!record) return null;
  const parts: string[] = [];
  if (record.memorySummary?.trim()) parts.push(record.memorySummary.trim());
  const kinkLine = formatKinkProfileLine(record.kinkProfile);
  if (kinkLine) parts.push(kinkLine);
  if (!parts.length) return null;
  return parts.join("\n\n").slice(0, MAX_SUMMARY);
}

/** Clear durable character memory for account + character (account privacy). */
export async function clearCharacterSession(
  userId: string,
  characterId: string,
): Promise<boolean> {
  if (!isCharacterSessionDbConfigured() || !userId?.trim() || !characterId?.trim()) {
    return false;
  }
  try {
    await prisma.characterSession.deleteMany({
      where: { userId: userId.trim(), characterId: characterId.trim() },
    });
    return true;
  } catch (error) {
    console.error("[character-session] clear failed:", error);
    return false;
  }
}
