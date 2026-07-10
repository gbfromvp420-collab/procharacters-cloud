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
  file.byCharacter[characterId] = {
    characterId,
    characterName: options.characterName ?? prev?.characterName,
    sessionId: options.sessionId,
    resumeCode: options.resumeCode.trim().toUpperCase(),
    updatedAt: new Date().toISOString(),
    source: prev?.source === "account" || !options.characterName ? prev?.source ?? "local" : "local",
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
