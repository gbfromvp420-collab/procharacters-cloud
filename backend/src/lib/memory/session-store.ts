import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoPath } from "../paths.js";
import type { SessionRecord } from "../../types/session.js";

function resolveSessionsDir(): string {
  if (process.env.SESSIONS_PATH?.trim()) {
    return process.env.SESSIONS_PATH.trim();
  }
  // Prefer volume-backed /data when present (Docker/Railway).
  if (process.env.CUSTOM_CHARACTERS_PATH?.startsWith("/data")) {
    return "/data/sessions";
  }
  return repoPath("data", "sessions");
}

let sessionsDir: string | null = null;

export async function initSessionStore(dir?: string): Promise<{
  path: string;
}> {
  const resolved = dir?.trim() || resolveSessionsDir();
  sessionsDir = resolved;
  await mkdir(resolved, { recursive: true });
  return { path: resolved };
}

function filePath(sessionId: string): string {
  if (!sessionsDir) {
    throw new Error("Session store not initialized");
  }
  // Guard path traversal — UUIDs only in practice.
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe || safe !== sessionId) {
    throw new Error("Invalid session id for persistence");
  }
  return join(sessionsDir, `${safe}.json`);
}

export async function saveSessionRecord(record: SessionRecord): Promise<void> {
  if (!sessionsDir) {
    await initSessionStore();
  }
  const path = filePath(record.id);
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function loadSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  if (!sessionsDir) {
    await initSessionStore();
  }
  try {
    const raw = await readFile(filePath(sessionId), "utf8");
    const parsed = JSON.parse(raw) as SessionRecord;
    if (!parsed?.id || !parsed.wsToken || !parsed.memory) return null;
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return null;
    console.error(`[session-store] failed to load ${sessionId}:`, error);
    return null;
  }
}

export async function deleteSessionRecord(sessionId: string): Promise<void> {
  if (!sessionsDir) return;
  try {
    await unlink(filePath(sessionId));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.error(`[session-store] failed to delete ${sessionId}:`, error);
    }
  }
}

export async function listSessionRecords(options?: {
  accountId?: string;
  limit?: number;
}): Promise<SessionRecord[]> {
  if (!sessionsDir) {
    await initSessionStore();
  }
  const limit = options?.limit ?? 50;
  const out: SessionRecord[] = [];
  try {
    const files = await readdir(sessionsDir!);
    for (const name of files) {
      if (!name.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(sessionsDir!, name), "utf8");
        const record = JSON.parse(raw) as SessionRecord;
        if (options?.accountId && record.accountId !== options.accountId) continue;
        out.push(record);
      } catch {
        /* skip bad files */
      }
    }
  } catch {
    return [];
  }

  out.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  return out.slice(0, limit);
}

/** Best-effort cleanup of very old ended sessions (days). */
export async function pruneOldSessions(maxAgeDays = 14): Promise<number> {
  if (!sessionsDir) return 0;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  try {
    const files = await readdir(sessionsDir);
    for (const name of files) {
      if (!name.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(sessionsDir, name), "utf8");
        const record = JSON.parse(raw) as SessionRecord;
        const stamp = new Date(record.updatedAt || record.createdAt).getTime();
        if (record.status === "ended" && stamp < cutoff) {
          await unlink(join(sessionsDir, name));
          removed += 1;
        }
      } catch {
        /* skip bad files */
      }
    }
  } catch {
    /* ignore */
  }
  return removed;
}

export function getSessionsDir(): string | null {
  return sessionsDir;
}
