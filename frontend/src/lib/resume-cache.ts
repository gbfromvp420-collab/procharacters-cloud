/**
 * Cross-device resume codes: prefer account session list, fall back to last local session.
 * Cache is updated whenever the client lists account sessions or saves a local resume.
 */

import type { AccountSessionSummary } from "./api";
import { loadStoredSession } from "./session-storage";

const CACHE_KEY = "procharacters.resumeByCharacter.v1";

/** Soft heat depth labels — mirror chat SessionDepthMeter. */
export type HeatTrailDepth = "spark" | "warm" | "edge" | "deep" | "locked";

/** Local heat trail stamped on resume so gallery return shows where you left off. */
export type HeatTrail = {
  recapLine?: string;
  heatDepth?: HeatTrailDepth;
  heatChips?: string[];
  messageCount?: number;
  mindTag?: string;
  /** Studio Forge DNA tree node when left mid-climb. */
  dnaTreeNodeId?: string;
  dnaTreeLabel?: string;
};

export type ResumeCacheEntry = {
  characterId: string;
  characterName?: string;
  sessionId: string;
  resumeCode: string;
  updatedAt: string;
  source: "account" | "local";
  /** ISO when the resume code expires (for urgency on Continue UI). */
  resumeExpiresAt?: string;
  /** Short “who you left on edge” line for Continue banner / recap. */
  recapLine?: string;
  /** Heat Arc depth at last stamp (spark→locked). */
  heatDepth?: HeatTrailDepth;
  /** Compact scene/heat chips for gallery tiles. */
  heatChips?: string[];
  /** Message count when trail was stamped. */
  messageCount?: number;
  /** Mind fingerprint tag (Post-set, Shy heat, …). */
  mindTag?: string;
  /** Studio Forge DNA tree node at last stamp. */
  dnaTreeNodeId?: string;
  dnaTreeLabel?: string;
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
    const sameSession = prev?.sessionId === s.sessionId;
    // Server DNA node wins for multi-device reclaim; keep local label when same node
    const serverNode = s.dnaTreeNodeId?.trim() || undefined;
    const localNode = sameSession ? prev?.dnaTreeNodeId : undefined;
    const dnaTreeNodeId = serverNode || localNode;
    const dnaTreeLabel =
      sameSession && prev?.dnaTreeNodeId === dnaTreeNodeId
        ? prev?.dnaTreeLabel
        : serverNode
          ? dnaLabelFromNodeId(serverNode)
          : undefined;
    // Edge Pace on server ⇒ heat trail is hot enough for reclaim chips
    const heatDepth =
      sameSession && prev?.heatDepth
        ? prev.heatDepth
        : s.sessionMode === "edge_pace" || isDnaPowerTrail({ dnaTreeNodeId, heatDepth: undefined })
          ? ("edge" as HeatTrailDepth)
          : undefined;

    file.byCharacter[s.characterId] = {
      characterId: s.characterId,
      characterName: s.characterName,
      sessionId: s.sessionId,
      resumeCode: s.resumeCode,
      updatedAt: nextUpdated || new Date().toISOString(),
      source: "account",
      resumeExpiresAt: s.resumeExpiresAt || prev?.resumeExpiresAt,
      // Preserve local heat trail when re-syncing the same session
      recapLine: sameSession ? prev?.recapLine : prev?.recapLine,
      heatDepth: heatDepth ?? (sameSession ? prev?.heatDepth : undefined),
      heatChips: sameSession ? prev?.heatChips : undefined,
      messageCount: sameSession
        ? prev?.messageCount ?? s.messageCount
        : s.messageCount || undefined,
      mindTag: sameSession ? prev?.mindTag : undefined,
      dnaTreeNodeId,
      dnaTreeLabel,
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
  recapLine?: string | null;
  heatDepth?: HeatTrailDepth | null;
  heatChips?: string[] | null;
  messageCount?: number | null;
  mindTag?: string | null;
  dnaTreeNodeId?: string | null;
  dnaTreeLabel?: string | null;
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
  const sameSession = prev?.sessionId === options.sessionId;
  const nextExpiry =
    options.resumeExpiresAt?.trim() ||
    (sameSession ? prev.resumeExpiresAt : undefined);
  const nextRecap =
    options.recapLine?.trim() || (sameSession ? prev?.recapLine : undefined);
  const nextDepth =
    options.heatDepth || (sameSession ? prev?.heatDepth : undefined);
  const nextChips =
    options.heatChips?.length
      ? options.heatChips.slice(0, 5)
      : sameSession
        ? prev?.heatChips
        : undefined;
  const nextCount =
    typeof options.messageCount === "number"
      ? options.messageCount
      : sameSession
        ? prev?.messageCount
        : undefined;
  const nextMind =
    options.mindTag?.trim() || (sameSession ? prev?.mindTag : undefined);
  const nextDnaNode =
    options.dnaTreeNodeId?.trim() ||
    (sameSession ? prev?.dnaTreeNodeId : undefined);
  const nextDnaLabel =
    options.dnaTreeLabel?.trim() ||
    (sameSession ? prev?.dnaTreeLabel : undefined);

  file.byCharacter[characterId] = {
    characterId,
    characterName: options.characterName ?? prev?.characterName,
    sessionId: options.sessionId,
    resumeCode: options.resumeCode.trim().toUpperCase(),
    updatedAt: new Date().toISOString(),
    source: prev?.source === "account" || !options.characterName ? prev?.source ?? "local" : "local",
    resumeExpiresAt: nextExpiry,
    recapLine: nextRecap,
    heatDepth: nextDepth,
    heatChips: nextChips,
    messageCount: nextCount,
    mindTag: nextMind,
    dnaTreeNodeId: nextDnaNode,
    dnaTreeLabel: nextDnaLabel,
  };
  // Prefer account source when we already had account for this character
  if (prev?.source === "account") {
    file.byCharacter[characterId]!.source = "account";
  }
  writeCache(file);
}

/** Map message count → heat depth label. */
export function heatDepthFromCount(messageCount: number): HeatTrailDepth {
  if (messageCount >= 20) return "locked";
  if (messageCount >= 12) return "deep";
  if (messageCount >= 6) return "edge";
  if (messageCount >= 2) return "warm";
  return "spark";
}

/** Pull a short human recap from session notes (“Last character beat”, pose, vibe). */
export function recapFromSessionNotes(notes?: string | null): string | null {
  if (!notes?.trim()) return null;
  const text = notes.replace(/\s+/g, " ").trim();
  const lastBeat = text.match(/Last character beat:\s*[“"](.+?)[”"]/i)?.[1]?.trim();
  if (lastBeat) {
    return lastBeat.length > 110 ? `${lastBeat.slice(0, 107).trim()}…` : lastBeat;
  }
  // Prefer spoken scene bits over raw lock dump
  const scene = text.match(/Scene lock:\s*([^.]{8,140})/i)?.[1] ?? "";
  const pose = scene.match(/pose=([^;]+)/i)?.[1]?.trim();
  const act = scene.match(/act=([^;]+)/i)?.[1]?.trim();
  const clothing = scene.match(/clothing="([^"]+)"/i)?.[1]?.trim();
  const spoken = [pose, act, clothing]
    .filter((x) => x && !/live cam presence|^tease \/ escalate$/i.test(x))
    .slice(0, 2);
  if (spoken.length) {
    const line = spoken.join(" · ");
    return line.length > 90 ? `${line.slice(0, 87).trim()}…` : line;
  }
  const vibe = text.match(/Ongoing vibe:\s*([^.]+)/i)?.[1]?.trim();
  if (vibe) {
    const clean = vibe.replace(/heat · \w+;?\s*/i, "").trim();
    if (clean) return clean.length > 90 ? `${clean.slice(0, 87).trim()}…` : clean;
  }
  if (scene) return scene.length > 90 ? `${scene.slice(0, 87).trim()}…` : scene;
  return null;
}

/** Build full heat trail for gallery / Continue from live session notes. */
export function heatTrailFromSession(options: {
  sessionNotes?: string | null;
  messageCount?: number;
  mindTag?: string | null;
  dnaTreeNodeId?: string | null;
  dnaTreeLabel?: string | null;
}): HeatTrail {
  const notes = options.sessionNotes ?? "";
  const messageCount = options.messageCount ?? 0;
  const chips: string[] = [];
  const text = notes.replace(/\s+/g, " ").trim();

  const scene = text.match(/Scene lock:\s*([^.]{0,160})/i)?.[1] ?? "";
  const clothing = scene.match(/clothing="([^"]+)"/i)?.[1]?.trim();
  const pose = scene.match(/pose=([^;]+)/i)?.[1]?.trim();
  const act = scene.match(/act=([^;]+)/i)?.[1]?.trim();
  const arousal = scene.match(/arousal=([^;]+)/i)?.[1]?.trim();
  if (pose && !/live cam presence/i.test(pose)) chips.push(pose);
  if (act && !/^tease \/ escalate$/i.test(act)) chips.push(act);
  if (clothing) chips.push(clothing);
  if (arousal && /edge|peak|high|denial|aroused/i.test(arousal)) {
    chips.push(arousal.length > 22 ? `${arousal.slice(0, 20)}…` : arousal);
  }

  const vibe = text.match(/Ongoing vibe:\s*([^.]+)/i)?.[1] ?? "";
  for (const part of vibe.split(";")) {
    const p = part.trim();
    if (
      p &&
      chips.length < 5 &&
      /edge|denial|sheer|crotchless|gym|shy|brat|goth|kiss|hand|pace|dna tree/i.test(p) &&
      !/^heat ·/i.test(p)
    ) {
      chips.push(p.length > 24 ? `${p.slice(0, 22)}…` : p);
    }
  }

  // DNA tree · Edge ↑ from session notes
  const dnaFromNotes = text.match(/DNA tree ·\s*([^↑.]+)/i)?.[1]?.trim();
  const dnaTreeLabel =
    options.dnaTreeLabel?.trim() || dnaFromNotes || undefined;
  const dnaTreeNodeId = options.dnaTreeNodeId?.trim() || undefined;
  if (dnaTreeLabel && chips.length < 5) {
    chips.unshift(
      dnaTreeLabel.length > 22 ? `DNA ${dnaTreeLabel.slice(0, 18)}…` : `DNA ${dnaTreeLabel}`,
    );
  }

  // Depth from notes label or message count
  const fromNotes = text.match(/heat · (spark|warm|edge|deep|locked)/i)?.[1]?.toLowerCase() as
    | HeatTrailDepth
    | undefined;
  const heatDepth = fromNotes || heatDepthFromCount(messageCount);

  return {
    recapLine: recapFromSessionNotes(notes) ?? undefined,
    heatDepth,
    heatChips: uniqueChips(chips).slice(0, 4),
    messageCount: messageCount > 0 ? messageCount : undefined,
    mindTag: options.mindTag?.trim() || undefined,
    ...(dnaTreeNodeId ? { dnaTreeNodeId } : {}),
    ...(dnaTreeLabel ? { dnaTreeLabel } : {}),
  };
}

function uniqueChips(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
  }
  return out;
}

/** Patch recap + heat trail on an existing resume entry. */
export function rememberResumeRecap(
  characterId: string,
  recapLine: string | null | undefined,
  trail?: HeatTrail | null,
): void {
  if (!characterId) return;
  const file = readCache();
  const prev = file.byCharacter[characterId];
  if (!prev?.resumeCode) return;
  const line = recapLine?.trim() || trail?.recapLine?.trim() || prev.recapLine;
  file.byCharacter[characterId] = {
    ...prev,
    recapLine: line,
    heatDepth: trail?.heatDepth ?? prev.heatDepth,
    heatChips: trail?.heatChips?.length ? trail.heatChips : prev.heatChips,
    messageCount: trail?.messageCount ?? prev.messageCount,
    mindTag: trail?.mindTag ?? prev.mindTag,
    dnaTreeNodeId: trail?.dnaTreeNodeId ?? prev.dnaTreeNodeId,
    dnaTreeLabel: trail?.dnaTreeLabel ?? prev.dnaTreeLabel,
    updatedAt: new Date().toISOString(),
  };
  writeCache(file);
}

/** Stamp heat trail onto resume for a character (keeps code/session). */
export function rememberHeatTrail(characterId: string, trail: HeatTrail): void {
  if (!characterId) return;
  const file = readCache();
  const prev = file.byCharacter[characterId];
  if (!prev?.resumeCode) return;
  file.byCharacter[characterId] = {
    ...prev,
    recapLine: trail.recapLine?.trim() || prev.recapLine,
    heatDepth: trail.heatDepth ?? prev.heatDepth,
    heatChips: trail.heatChips?.length ? trail.heatChips.slice(0, 4) : prev.heatChips,
    messageCount: trail.messageCount ?? prev.messageCount,
    mindTag: trail.mindTag ?? prev.mindTag,
    dnaTreeNodeId: trail.dnaTreeNodeId ?? prev.dnaTreeNodeId,
    dnaTreeLabel: trail.dnaTreeLabel ?? prev.dnaTreeLabel,
    updatedAt: new Date().toISOString(),
  };
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

/** Pretty DNA node label from server node id (multi-device reclaim). */
export function dnaLabelFromNodeId(nodeId?: string | null): string | undefined {
  if (!nodeId?.trim()) return undefined;
  const id = nodeId.trim().toLowerCase();
  if (id.includes("release")) return "Release";
  if (id.includes("deny")) return "Deny";
  if (id.includes("edge")) return "Edge";
  if (id.includes("tease")) return "Tease";
  if (id.includes("soft")) return "Soft lock";
  if (id.includes("spark")) return "Spark";
  return nodeId.trim();
}

/** True when heat trail is mid DNA climb — reclaim should reopen Edge Pace. */
export function isDnaPowerTrail(
  entry: Pick<ResumeCacheEntry, "dnaTreeNodeId" | "dnaTreeLabel" | "heatDepth">,
): boolean {
  const dna = `${entry.dnaTreeLabel || ""} ${entry.dnaTreeNodeId || ""}`.toLowerCase();
  if (/edge|deny|release|gate|tease/.test(dna)) return true;
  return (
    entry.heatDepth === "edge" ||
    entry.heatDepth === "deep" ||
    entry.heatDepth === "locked"
  );
}

/**
 * Chat deep-link for a resume entry. Always requests full memory rehydrate.
 * DNA power trails auto-attach mode=edge_pace so Continue reclaims the climb.
 */
export function buildResumeChatPath(
  entry: Pick<
    ResumeCacheEntry,
    "resumeCode" | "characterId" | "dnaTreeNodeId" | "dnaTreeLabel" | "heatDepth"
  >,
  options?: { edgePace?: boolean },
): string {
  const code = entry.resumeCode.trim().toUpperCase();
  const params = new URLSearchParams({ resume: code, rehydrate: "1" });
  if (entry.characterId) params.set("character", entry.characterId);
  const edge =
    options?.edgePace === true ||
    (options?.edgePace !== false && isDnaPowerTrail(entry));
  if (edge) params.set("mode", "edge_pace");
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
