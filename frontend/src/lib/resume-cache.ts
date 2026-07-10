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
};

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
}): void {
  if (!options.resumeCode?.trim()) return;
  const file = readCache();
  const prev = file.byCharacter[options.characterId];
  // Don't overwrite a newer account-sourced entry with local-only
  if (prev?.source === "account" && prev.resumeCode) {
    // still refresh if same session got a code
    if (prev.sessionId !== options.sessionId) {
      return;
    }
  }
  file.byCharacter[options.characterId] = {
    characterId: options.characterId,
    characterName: options.characterName ?? undefined,
    sessionId: options.sessionId,
    resumeCode: options.resumeCode.trim().toUpperCase(),
    updatedAt: new Date().toISOString(),
    source: prev?.source === "account" ? "account" : "local",
  };
  writeCache(file);
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
    };
  }
  return null;
}

export function clearResumeCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
