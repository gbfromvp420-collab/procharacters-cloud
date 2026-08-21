/**
 * Dedicated avatar pack resolution (Phase 4 drop-in readiness).
 *
 * When all four loop files exist under frontend/public/avatar/<id>/,
 * resolveClipPath prefers that folder and keeps avatarBase as fallback.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { repoPath } from "../paths.js";
import { LIVE_CHARACTER_CATALOG } from "../live/character-catalog.js";

const CLIP_KEYS = ["idle", "teasing", "playful", "aroused"] as const;
type ClipKey = (typeof CLIP_KEYS)[number];

export type PackStatus = {
  id: string;
  ready: boolean;
  missing: ClipKey[];
  present: ClipKey[];
  avatarBase: string;
  dir: string;
};

const PHASE4_IDS = [
  "twink-shy-boy",
  "twink-gym",
  "twink-alt-punk",
  "female-soft-goth",
  "female-athletic-tease",
  "female-playful-brat",
] as const;

let cache: Map<string, boolean> | null = null;
let cacheLoadedAt = 0;
const CACHE_MS = 30_000;

function avatarRootCandidates(): string[] {
  return [
    repoPath("frontend", "public", "avatar"),
    repoPath("public", "avatar"),
    join(process.cwd(), "frontend", "public", "avatar"),
    join(process.cwd(), "public", "avatar"),
    // Docker monorepo image sometimes copies avatars next to app
    "/app/frontend/public/avatar",
    "/app/public/avatar",
  ];
}

function findAvatarRoot(): string | null {
  for (const root of avatarRootCandidates()) {
    if (existsSync(root)) return root;
  }
  return null;
}

function packDir(root: string, id: string): string {
  return join(root, id);
}

/** True only when all four clip files exist under a discovered avatar root. */
function scanPackFilesReady(id: string): boolean {
  const root = findAvatarRoot();
  if (!root) return false;
  const dir = packDir(root, id);
  if (!existsSync(dir)) return false;
  return CLIP_KEYS.every((clip) => {
    const mp4 = join(dir, `${clip}.mp4`);
    const webm = join(dir, `${clip}.webm`);
    return existsSync(mp4) || existsSync(webm);
  });
}

function readStatusJsonReady(): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const root of avatarRootCandidates()) {
    const statusPath = join(root, "packs", "status.json");
    if (!existsSync(statusPath)) continue;
    try {
      const raw = JSON.parse(readFileSync(statusPath, "utf8")) as {
        ready?: string[];
        packs?: Record<string, { ready?: boolean }>;
      };
      if (Array.isArray(raw.ready)) {
        for (const id of raw.ready) map.set(id, true);
      }
      if (raw.packs && typeof raw.packs === "object") {
        for (const [id, meta] of Object.entries(raw.packs)) {
          if (meta?.ready) map.set(id, true);
        }
      }
      break;
    } catch {
      /* ignore bad status */
    }
  }
  return map;
}

/**
 * API images often ship without MP4s (web serves them). Readiness is:
 * status.json OR files on disk OR AVATAR_PACKS_READY env.
 * Files on disk still win for true; never clear a true from status/env just
 * because the API container has no avatar binary tree.
 */
function loadReadyMap(): Map<string, boolean> {
  const now = Date.now();
  if (cache && now - cacheLoadedAt < CACHE_MS) return cache;

  const map = readStatusJsonReady();

  const ids = new Set([...Object.keys(LIVE_CHARACTER_CATALOG), ...PHASE4_IDS]);
  for (const id of ids) {
    if (scanPackFilesReady(id)) map.set(id, true);
    else if (!map.has(id)) map.set(id, false);
  }

  const envList = process.env.AVATAR_PACKS_READY?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (envList) {
    for (const id of envList) map.set(id, true);
  }

  cache = map;
  cacheLoadedAt = now;
  return map;
}

export function isDedicatedPackReady(characterId: string): boolean {
  return loadReadyMap().get(characterId) === true;
}

export function invalidatePackCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}

/**
 * Primary media folder id + optional fallback folder when primary 404s client-side.
 */
export function resolvePackMediaIds(characterId: string): {
  primary: string;
  fallback?: string;
} {
  const profile = LIVE_CHARACTER_CATALOG[characterId];
  const base = profile?.avatarBase ?? characterId;

  if (isDedicatedPackReady(characterId)) {
    return {
      primary: characterId,
      fallback: base !== characterId ? base : undefined,
    };
  }

  // Defaults & customs without dedicated packs
  return { primary: base };
}

export function listPackStatuses(): PackStatus[] {
  const root = findAvatarRoot() ?? "(not found)";
  const readyMap = loadReadyMap();
  const ids = new Set([...Object.keys(LIVE_CHARACTER_CATALOG), ...PHASE4_IDS]);

  return [...ids].sort().map((id) => {
    const avatarBase = LIVE_CHARACTER_CATALOG[id]?.avatarBase ?? id;
    const dir =
      typeof root === "string" && root !== "(not found)"
        ? packDir(root, id)
        : `(missing-root)/${id}`;
    const present: ClipKey[] = [];
    const missing: ClipKey[] = [];
    if (typeof root === "string" && root !== "(not found)" && existsSync(dir)) {
      for (const clip of CLIP_KEYS) {
        const ok = existsSync(join(dir, `${clip}.mp4`)) || existsSync(join(dir, `${clip}.webm`));
        if (ok) present.push(clip);
        else missing.push(clip);
      }
    } else {
      missing.push(...CLIP_KEYS);
    }
    // Prefer unified readiness (status.json / files / env) so API health matches
    // gallery badges even when this container does not ship MP4 binaries.
    const ready =
      readyMap.get(id) === true || (missing.length === 0 && present.length === CLIP_KEYS.length);
    return {
      id,
      ready,
      missing,
      present,
      avatarBase,
      dir,
    };
  });
}

export function buildPackStatusFile(): {
  updatedAt: string;
  ready: string[];
  packs: Record<string, { ready: boolean; missing: string[]; avatarBase: string }>;
} {
  const statuses = listPackStatuses();
  const packs: Record<string, { ready: boolean; missing: string[]; avatarBase: string }> = {};
  for (const s of statuses) {
    packs[s.id] = {
      ready: s.ready,
      missing: s.missing,
      avatarBase: s.avatarBase,
    };
  }
  return {
    updatedAt: new Date().toISOString(),
    ready: statuses.filter((s) => s.ready).map((s) => s.id),
    packs,
  };
}

/** Phase 4 ids that need dedicated footage. */
export function phase4PackIds(): readonly string[] {
  return PHASE4_IDS;
}

export function avatarRootPath(): string | null {
  return findAvatarRoot();
}

/** List files in a pack dir (debug). */
export function listPackFiles(id: string): string[] {
  const root = findAvatarRoot();
  if (!root) return [];
  const dir = packDir(root, id);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).filter((f) => {
      try {
        return statSync(join(dir, f)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}
