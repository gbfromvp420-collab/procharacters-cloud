/**
 * Cross-device resume codes: prefer account session list, fall back to last local session.
 * Cache is updated whenever the client lists account sessions or saves a local resume.
 */

import type { AccountSessionSummary } from "./api";
import { loadStoredSession } from "./session-storage";

const CACHE_KEY = "procharacters.resumeByCharacter.v1";

export type ResumeCacheEntry = {
  characterId: string;
  characterName?: string;
  sessionId: string;
  resumeCode: string;
  updatedAt: string;
  source: "account" | "local";
  /** ISO when the resume code expires (for urgency on Continue UI). */
  resumeExpiresAt?: string;
};

/** Short urgency label for gallery / banner (e.g. "expires in 2d"). */
export function formatResumeExpiryShort(iso?: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "expired";
  if (days === 0) return "expires today";
  if (days === 1) return "expires tomorrow";
  return `expires in ${days}d`;
}

/** True when code is gone or within 2 days — style Continue as urgent. */
export function isResumeExpiryUrgent(iso?: string | null): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const days = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
  return days <= 2;
}

type CacheFile = {
  byCharacter: Record<string, ResumeCacheEntry>;
  savedAt: string;
};

function readCache(): CacheFile {
  if (typeof window === "undefined") return { byCharacter: {}, savedAt: "" };
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return { byCharacter: {}, savedAt: "" };
    const parsed = JSON.parse(raw) as CacheFile;
    if (!parsed?.byCharacter || typeof parsed.byCharacter !== "object") {
      return { byCharacter: {}, savedAt: "" };
    }
    return parsed;
  } catch {
    return { byCharacter: {}, savedAt: "" };
  }
}

function writeCache(file: CacheFile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...file, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore */
  }
}

/** Merge account session list into local resume cache (newest per character wins). */
export function syncResumeCacheFromAccountSessions(
  sessions: AccountSessionSummary[],
): void {
  const file = readCache();
  // list is already newest-first from API
  const seen = new Set<string>();
  for (const s of sessions) {
    if (!s.resumeCode || !s.characterId) continue;
    if (seen.has(s.characterId)) continue;
    seen.add(s.characterId);
    const prev = file.byCharacter[s.characterId];
    const nextUpdated = s.updatedAt || s.createdAt;
    if (
      prev &&
      prev.source === "account" &&
      prev.updatedAt &&
      nextUpdated &&
      prev.updatedAt.localeCompare(nextUpdated) > 0
    ) {
      continue;
    }
    file.byCharacter[s.characterId] = {
      characterId: s.characterId,
      characterName: s.characterName,
      sessionId: s.sessionId,
      resumeCode: s.resumeCode,
      updatedAt: nextUpdated || new Date().toISOString(),
      source: "account",
      resumeExpiresAt: s.resumeExpiresAt || prev?.resumeExpiresAt,
    };
  }
  writeCache(file);
}

/** Remember a local-device resume (used when not signed in or as backup). */
export function rememberLocalResume(options: {
  characterId: string;
  characterName?: string | null;
  sessionId: string;
  resumeCode: string;
  resumeExpiresAt?: string | null;
}): void {
  if (!options.resumeCode?.trim()) return;
  const file = readCache();
  // Allow update by sessionId alone when characterId unknown
  let characterId = options.characterId?.trim();
  if (!characterId) {
    const hit = Object.values(file.byCharacter).find((e) => e.sessionId === options.sessionId);
    characterId = hit?.characterId ?? "";
  }
  if (!characterId) return;

  const prev = file.byCharacter[characterId];
  // Don't overwrite a newer account-sourced entry with local-only for a *different* session
  if (prev?.source === "account" && prev.resumeCode && prev.sessionId !== options.sessionId) {
    return;
  }
  const nextExpiry =
    options.resumeExpiresAt?.trim() ||
    (prev?.sessionId === options.sessionId ? prev.resumeExpiresAt : undefined);
  file.byCharacter[characterId] = {
    characterId,
    characterName: options.characterName ?? prev?.characterName,
    sessionId: options.sessionId,
    resumeCode: options.resumeCode.trim().toUpperCase(),
    updatedAt: new Date().toISOString(),
    source: prev?.source === "account" || !options.characterName ? prev?.source ?? "local" : "local",
    resumeExpiresAt: nextExpiry,
  };
  // Prefer account source when we already had account for this character
  if (prev?.source === "account") {
    file.byCharacter[characterId]!.source = "account";
  }
  writeCache(file);
}

/** Drop a session's cached resume (e.g. after rotate — will re-sync on next list). */
export function invalidateResumeForSession(sessionId: string): void {
  const file = readCache();
  let changed = false;
  for (const [key, entry] of Object.entries(file.byCharacter)) {
    if (entry.sessionId === sessionId) {
      delete file.byCharacter[key];
      changed = true;
    }
  }
  if (changed) writeCache(file);
}

/** Best resume code for a character: cache → local last session. */
export function getResumeForCharacter(characterId: string): ResumeCacheEntry | null {
  const file = readCache();
  const cached = file.byCharacter[characterId];
  if (cached?.resumeCode) return cached;

  const local = loadStoredSession();
  if (local?.characterId === characterId && local.resumeCode) {
    return {
      characterId,
      characterName: local.characterName,
      sessionId: local.sessionId,
      resumeCode: local.resumeCode,
      updatedAt: local.savedAt,
      source: "local",
      resumeExpiresAt: local.resumeExpiresAt,
    };
  }
  return null;
}

/** All cached resumes (account + local), newest first. */
export function listResumeCacheEntries(): ResumeCacheEntry[] {
  const file = readCache();
  const byId = { ...file.byCharacter };

  // Fold in last local session if not already represented
  const local = loadStoredSession();
  if (local?.resumeCode && local.characterId) {
    const existing = byId[local.characterId];
    if (!existing) {
      byId[local.characterId] = {
        characterId: local.characterId,
        characterName: local.characterName,
        sessionId: local.sessionId,
        resumeCode: local.resumeCode,
        updatedAt: local.savedAt,
        source: "local",
        resumeExpiresAt: local.resumeExpiresAt,
      };
    } else if (
      existing.source !== "account" &&
      local.savedAt &&
      (!existing.updatedAt || local.savedAt.localeCompare(existing.updatedAt) > 0)
    ) {
      byId[local.characterId] = {
        characterId: local.characterId,
        characterName: local.characterName ?? existing.characterName,
        sessionId: local.sessionId,
        resumeCode: local.resumeCode,
        updatedAt: local.savedAt,
        source: "local",
        resumeExpiresAt: local.resumeExpiresAt ?? existing.resumeExpiresAt,
      };
    }
  }

  return Object.values(byId)
    .filter((e) => !!e.resumeCode)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

/**
 * Most recently updated resume for the "Continue where you left off" strip.
 * Prefers account/local cache; falls back to last local session.
 */
export function getMostRecentResume(): ResumeCacheEntry | null {
  const list = listResumeCacheEntries();
  if (list.length > 0) return list[0] ?? null;

  const local = loadStoredSession();
  if (local?.resumeCode && local.characterId) {
    return {
      characterId: local.characterId,
      characterName: local.characterName,
      sessionId: local.sessionId,
      resumeCode: local.resumeCode,
      updatedAt: local.savedAt,
      source: "local",
      resumeExpiresAt: local.resumeExpiresAt,
    };
  }
  return null;
}

/** Chat deep-link for a resume entry. Always requests full memory rehydrate. */
export function buildResumeChatPath(entry: Pick<ResumeCacheEntry, "resumeCode" | "characterId">): string {
  const code = entry.resumeCode.trim().toUpperCase();
  const params = new URLSearchParams({ resume: code, rehydrate: "1" });
  if (entry.characterId) params.set("character", entry.characterId);
  return `/chat?${params.toString()}`;
}

export function clearResumeCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
