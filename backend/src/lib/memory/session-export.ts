import type { SessionRecord } from "../../types/session.js";
import type { MemoryMessage } from "./types.js";

export const SESSION_EXPORT_SCHEMA = "procharacters.session-export/v1" as const;
export const ACCOUNT_SESSIONS_EXPORT_SCHEMA =
  "procharacters.account-sessions-export/v1" as const;

/** Public message row in an export (no server-only fields). */
export interface ExportedMessage {
  id: string;
  role: MemoryMessage["role"];
  content: string;
  createdAt: string;
}

/**
 * Portable session transcript — never includes wsToken, system prompts,
 * or LiveKit secrets.
 */
export interface SessionExport {
  schema: typeof SESSION_EXPORT_SCHEMA;
  exportedAt: string;
  session: {
    sessionId: string;
    characterId: string;
    characterName: string;
    promptVersion: string;
    status: SessionRecord["status"];
    resumeCode?: string;
    accountId?: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    messageCount: number;
    messages: ExportedMessage[];
    avatarState?: {
      emotion: string;
      pose: string;
      action: string;
      arousalLevel: number;
      clothingState: string;
    };
  };
}

export interface AccountSessionsExport {
  schema: typeof ACCOUNT_SESSIONS_EXPORT_SCHEMA;
  exportedAt: string;
  accountId: string;
  handle?: string;
  sessionCount: number;
  totalMessages: number;
  sessions: SessionExport["session"][];
}

function mapMessages(record: SessionRecord): ExportedMessage[] {
  const list = record.memory?.messages ?? [];
  return list.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }));
}

/** Build a single-session export document from a store record. */
export function buildSessionExport(record: SessionRecord): SessionExport {
  const messages = mapMessages(record);
  const avatar = record.avatarState;
  return {
    schema: SESSION_EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    session: {
      sessionId: record.id,
      characterId: record.characterId,
      characterName: record.promptSnapshot?.characterName ?? record.characterId,
      promptVersion: record.promptVersion,
      status: record.status,
      ...(record.resumeCode ? { resumeCode: record.resumeCode } : {}),
      ...(record.accountId ? { accountId: record.accountId } : {}),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      expiresAt: record.expiresAt,
      messageCount: messages.length,
      messages,
      ...(avatar
        ? {
            avatarState: {
              emotion: avatar.emotion,
              pose: avatar.pose,
              action: avatar.action,
              arousalLevel: avatar.arousalLevel,
              clothingState: avatar.clothingState,
            },
          }
        : {}),
    },
  };
}

export function buildAccountSessionsExport(options: {
  accountId: string;
  handle?: string;
  records: SessionRecord[];
}): AccountSessionsExport {
  const sessions = options.records.map((r) => buildSessionExport(r).session);
  return {
    schema: ACCOUNT_SESSIONS_EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    accountId: options.accountId,
    ...(options.handle ? { handle: options.handle } : {}),
    sessionCount: sessions.length,
    totalMessages: sessions.reduce((n, s) => n + s.messageCount, 0),
    sessions,
  };
}

export function exportFilename(characterName: string, sessionId: string): string {
  const safe = characterName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const short = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const day = new Date().toISOString().slice(0, 10);
  return `procharacters-${safe || "chat"}-${short}-${day}.json`;
}
