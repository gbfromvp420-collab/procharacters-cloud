/**
 * Opt-in cross-session notes per account + character.
 * Lightweight JSON file on volume — not a full vector memory.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { repoPath } from "../paths.js";

export interface CrossSessionNote {
  notes: string;
  updatedAt: string;
  optIn: boolean;
  messageCountHint?: number;
}

interface CrossSessionFile {
  version: 1;
  updatedAt: string;
  /** accountId → characterId → note */
  byAccount: Record<string, Record<string, CrossSessionNote>>;
}

let loaded = false;
let persistPath: string | null = null;
let data: CrossSessionFile = {
  version: 1,
  updatedAt: new Date().toISOString(),
  byAccount: {},
};

function resolvePath(): string {
  if (process.env.CROSS_SESSION_NOTES_PATH?.trim()) {
    return process.env.CROSS_SESSION_NOTES_PATH.trim();
  }
  return repoPath("data", "cross-session-notes.json");
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  persistPath = resolvePath();
  try {
    const raw = await readFile(persistPath, "utf8");
    const parsed = JSON.parse(raw) as CrossSessionFile;
    if (parsed?.byAccount && typeof parsed.byAccount === "object") {
      data = {
        version: 1,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        byAccount: parsed.byAccount,
      };
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.error("[cross-session-notes] load failed:", error);
    }
  }
  loaded = true;
}

async function persist(): Promise<void> {
  if (!persistPath) return;
  data.updatedAt = new Date().toISOString();
  await mkdir(dirname(persistPath), { recursive: true });
  await writeFile(persistPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function getCrossSessionNote(
  accountId: string,
  characterId: string,
): Promise<CrossSessionNote | null> {
  await ensureLoaded();
  return data.byAccount[accountId]?.[characterId] ?? null;
}

export async function setCrossSessionOptIn(
  accountId: string,
  characterId: string,
  optIn: boolean,
): Promise<CrossSessionNote> {
  await ensureLoaded();
  if (!data.byAccount[accountId]) data.byAccount[accountId] = {};
  const prev = data.byAccount[accountId]![characterId];
  const next: CrossSessionNote = {
    notes: prev?.notes ?? "",
    updatedAt: new Date().toISOString(),
    optIn,
    messageCountHint: prev?.messageCountHint,
  };
  data.byAccount[accountId]![characterId] = next;
  await persist();
  return next;
}

/** Save notes only when opt-in is already true (or forceOptIn). */
export async function saveCrossSessionNotes(
  accountId: string,
  characterId: string,
  notes: string,
  options?: { forceOptIn?: boolean; messageCountHint?: number },
): Promise<CrossSessionNote | null> {
  await ensureLoaded();
  if (!data.byAccount[accountId]) data.byAccount[accountId] = {};
  const prev = data.byAccount[accountId]![characterId];
  const optIn = options?.forceOptIn === true ? true : prev?.optIn === true;
  if (!optIn) return null;

  const next: CrossSessionNote = {
    notes: notes.slice(0, 1200),
    updatedAt: new Date().toISOString(),
    optIn: true,
    messageCountHint: options?.messageCountHint ?? prev?.messageCountHint,
  };
  data.byAccount[accountId]![characterId] = next;
  await persist();
  return next;
}
