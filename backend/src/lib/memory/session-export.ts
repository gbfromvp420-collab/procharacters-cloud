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

function slugPart(value: string, max = 40): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

export function exportFilename(
  characterName: string,
  sessionId: string,
  ext: "json" | "md" = "json",
): string {
  const safe = slugPart(characterName);
  const short = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const day = new Date().toISOString().slice(0, 10);
  return `procharacters-${safe || "chat"}-${short}-${day}.${ext}`;
}

function formatStamp(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function escapeMd(text: string): string {
  // Preserve user content; fence if it looks like it would break structure
  if (text.includes("```")) {
    return text.replace(/```/g, "'''");
  }
  return text;
}

/** Readable single-session transcript (Markdown). */
export function buildSessionMarkdown(
  session: SessionExport["session"],
  options?: { exportedAt?: string },
): string {
  const exportedAt = options?.exportedAt ?? new Date().toISOString();
  const lines: string[] = [
    `# ${session.characterName}`,
    "",
    `> Procharacters.cloud transcript · ${session.status} · ${session.messageCount} messages`,
    "",
    "| | |",
    "|---|---|",
    `| Character | ${session.characterName} (\`${session.characterId}\`) |`,
    `| Prompt | ${session.promptVersion} |`,
    `| Session | \`${session.sessionId}\` |`,
  ];
  if (session.resumeCode) {
    lines.push(`| Resume code | \`${session.resumeCode}\` |`);
  }
  lines.push(
    `| Created | ${formatStamp(session.createdAt)} |`,
    `| Updated | ${formatStamp(session.updatedAt)} |`,
    `| Exported | ${formatStamp(exportedAt)} |`,
    "",
    "---",
    "",
    "## Conversation",
    "",
  );

  if (session.messages.length === 0) {
    lines.push("_No messages in this session._", "");
  } else {
    for (const msg of session.messages) {
      const who = msg.role === "user" ? "You" : session.characterName;
      lines.push(`### ${who}`);
      lines.push(`*${formatStamp(msg.createdAt)}*`);
      lines.push("");
      lines.push(escapeMd(msg.content));
      lines.push("");
    }
  }

  lines.push("---", "");
  lines.push("_Generated by Procharacters.cloud · Uncensored 18+ · KGC Ventures_");
  lines.push("");
  return lines.join("\n");
}

/** Multi-session account archive as one Markdown document. */
export function buildAccountSessionsMarkdown(doc: AccountSessionsExport): string {
  const lines: string[] = [
    `# Procharacters chat archive`,
    "",
    doc.handle ? `**Account:** @${doc.handle}` : `**Account id:** \`${doc.accountId}\``,
    "",
    `> ${doc.sessionCount} chats · ${doc.totalMessages} messages · exported ${formatStamp(doc.exportedAt)}`,
    "",
    "---",
    "",
  ];

  if (doc.sessions.length === 0) {
    lines.push("_No saved chats._", "");
  } else {
    doc.sessions.forEach((session, i) => {
      lines.push(`## ${i + 1}. ${session.characterName}`);
      lines.push("");
      // Drop the H1 from single-session builder; reuse body after first heading block
      const full = buildSessionMarkdown(session, { exportedAt: doc.exportedAt });
      const body = full
        .split("\n")
        .slice(1) // drop "# name"
        .join("\n")
        .replace(/\n---\n\n_Generated by Procharacters[\s\S]*$/, "\n");
      lines.push(body.trimEnd(), "", "---", "");
    });
  }

  lines.push("_Generated by Procharacters.cloud · Uncensored 18+ · KGC Ventures_");
  lines.push("");
  return lines.join("\n");
}

export type ExportFormat = "json" | "md";

export function parseExportFormat(value: unknown): ExportFormat {
  if (typeof value === "string" && value.toLowerCase() === "md") return "md";
  if (typeof value === "string" && value.toLowerCase() === "markdown") return "md";
  return "json";
}

// ── Import / restore ────────────────────────────────────────────────────────

const MAX_IMPORT_MESSAGES = Number(process.env.MAX_IMPORT_MESSAGES ?? 100);
const MAX_MESSAGE_CHARS = Number(process.env.MAX_IMPORT_MESSAGE_CHARS ?? 8000);

export type ImportSessionPayload = SessionExport["session"];

export type ParseImportOk = {
  ok: true;
  session: ImportSessionPayload;
  sourceSchema: string;
  bulkIndex?: number;
  bulkTotal?: number;
};

export type ParseImportErr = {
  ok: false;
  error: string;
  code: "BAD_JSON" | "BAD_SCHEMA" | "EMPTY" | "BAD_MESSAGES" | "BAD_INDEX";
};

export type ParseImportResult = ParseImportOk | ParseImportErr;

function isRole(v: unknown): v is MemoryMessage["role"] {
  return v === "user" || v === "assistant";
}

function sanitizeMessages(raw: unknown): {
  messages: ExportedMessage[];
  truncated: boolean;
  dropped: number;
} {
  if (!Array.isArray(raw)) {
    return { messages: [], truncated: false, dropped: 0 };
  }

  const cleaned: ExportedMessage[] = [];
  let dropped = 0;

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      dropped += 1;
      continue;
    }
    const row = item as Record<string, unknown>;
    if (!isRole(row.role)) {
      dropped += 1;
      continue;
    }
    const content = typeof row.content === "string" ? row.content.trim() : "";
    if (!content) {
      dropped += 1;
      continue;
    }
    const id =
      typeof row.id === "string" && /^[a-zA-Z0-9_-]{6,80}$/.test(row.id)
        ? row.id
        : `import-${cleaned.length + 1}`;
    const createdAt =
      typeof row.createdAt === "string" && !Number.isNaN(Date.parse(row.createdAt))
        ? row.createdAt
        : new Date().toISOString();
    cleaned.push({
      id,
      role: row.role,
      content: content.slice(0, MAX_MESSAGE_CHARS),
      createdAt,
    });
  }

  const truncated = cleaned.length > MAX_IMPORT_MESSAGES;
  const messages = truncated ? cleaned.slice(-MAX_IMPORT_MESSAGES) : cleaned;
  return { messages, truncated, dropped };
}

function coerceSessionShape(
  raw: unknown,
): { session: ImportSessionPayload; truncated: boolean; dropped: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const characterId = typeof s.characterId === "string" ? s.characterId.trim() : "";
  if (!characterId || characterId.length > 80) return null;

  const { messages, truncated, dropped } = sanitizeMessages(s.messages);
  const characterName =
    typeof s.characterName === "string" && s.characterName.trim()
      ? s.characterName.trim().slice(0, 80)
      : characterId;
  const promptVersion =
    typeof s.promptVersion === "string" && s.promptVersion.trim()
      ? s.promptVersion.trim().slice(0, 40)
      : "v1";

  let avatarState: ImportSessionPayload["avatarState"];
  if (s.avatarState && typeof s.avatarState === "object") {
    const a = s.avatarState as Record<string, unknown>;
    avatarState = {
      emotion: String(a.emotion ?? "idle").slice(0, 40),
      pose: String(a.pose ?? "standing").slice(0, 40),
      action: String(a.action ?? "none").slice(0, 40),
      arousalLevel: Math.min(1, Math.max(0, Number(a.arousalLevel) || 0)),
      clothingState: String(a.clothingState ?? "dressed").slice(0, 40),
    };
  }

  const session: ImportSessionPayload = {
    sessionId: typeof s.sessionId === "string" ? s.sessionId : "imported",
    characterId,
    characterName,
    promptVersion,
    status: s.status === "ended" ? "ended" : "active",
    createdAt:
      typeof s.createdAt === "string" && !Number.isNaN(Date.parse(s.createdAt))
        ? s.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof s.updatedAt === "string" && !Number.isNaN(Date.parse(s.updatedAt))
        ? s.updatedAt
        : new Date().toISOString(),
    expiresAt:
      typeof s.expiresAt === "string" && !Number.isNaN(Date.parse(s.expiresAt))
        ? s.expiresAt
        : new Date().toISOString(),
    messageCount: messages.length,
    messages,
    ...(avatarState ? { avatarState } : {}),
  };

  return { session, truncated, dropped };
}

/**
 * Accept single-session export, bulk account export (+ optional index),
 * or a bare session object (from bulk.sessions[i]).
 */
export function parseImportDocument(
  input: unknown,
  options?: { sessionIndex?: number },
): ParseImportResult & { truncated?: boolean; dropped?: number } {
  if (input == null) {
    return { ok: false, error: "Empty import body", code: "EMPTY" };
  }

  let doc: unknown = input;
  // Allow { document: <export> } wrapper
  if (
    doc &&
    typeof doc === "object" &&
    "document" in doc &&
    (doc as { document: unknown }).document != null
  ) {
    doc = (doc as { document: unknown }).document;
  }

  if (!doc || typeof doc !== "object") {
    return { ok: false, error: "Import must be a JSON object", code: "BAD_JSON" };
  }

  const root = doc as Record<string, unknown>;
  const schema = typeof root.schema === "string" ? root.schema : "";

  // Single session export
  if (schema === SESSION_EXPORT_SCHEMA || ("session" in root && root.session)) {
    const coerced = coerceSessionShape(root.session);
    if (!coerced) {
      return {
        ok: false,
        error: "Invalid session object in export (need characterId + messages[])",
        code: "BAD_MESSAGES",
      };
    }
    if (coerced.session.messages.length === 0) {
      return {
        ok: false,
        error: "Export has no valid chat messages to restore",
        code: "EMPTY",
      };
    }
    return {
      ok: true,
      session: coerced.session,
      sourceSchema: schema || SESSION_EXPORT_SCHEMA,
      truncated: coerced.truncated,
      dropped: coerced.dropped,
    };
  }

  // Bulk account export
  if (schema === ACCOUNT_SESSIONS_EXPORT_SCHEMA || Array.isArray(root.sessions)) {
    const list = Array.isArray(root.sessions) ? root.sessions : [];
    if (list.length === 0) {
      return { ok: false, error: "Bulk export has no sessions", code: "EMPTY" };
    }
    const idx =
      typeof options?.sessionIndex === "number" && Number.isFinite(options.sessionIndex)
        ? Math.floor(options.sessionIndex)
        : typeof root.sessionIndex === "number"
          ? Math.floor(root.sessionIndex)
          : 0;
    if (idx < 0 || idx >= list.length) {
      return {
        ok: false,
        error: `sessionIndex ${idx} out of range (0–${list.length - 1})`,
        code: "BAD_INDEX",
      };
    }
    const coerced = coerceSessionShape(list[idx]);
    if (!coerced || coerced.session.messages.length === 0) {
      return {
        ok: false,
        error: `Session at index ${idx} has no valid messages`,
        code: "BAD_MESSAGES",
      };
    }
    return {
      ok: true,
      session: coerced.session,
      sourceSchema: schema || ACCOUNT_SESSIONS_EXPORT_SCHEMA,
      bulkIndex: idx,
      bulkTotal: list.length,
      truncated: coerced.truncated,
      dropped: coerced.dropped,
    };
  }

  // Bare session object
  if (typeof root.characterId === "string" && Array.isArray(root.messages)) {
    const coerced = coerceSessionShape(root);
    if (!coerced || coerced.session.messages.length === 0) {
      return {
        ok: false,
        error: "Bare session has no valid messages",
        code: "BAD_MESSAGES",
      };
    }
    return {
      ok: true,
      session: coerced.session,
      sourceSchema: "bare-session",
      truncated: coerced.truncated,
      dropped: coerced.dropped,
    };
  }

  return {
    ok: false,
    error: `Unsupported export schema. Expected ${SESSION_EXPORT_SCHEMA} or ${ACCOUNT_SESSIONS_EXPORT_SCHEMA}`,
    code: "BAD_SCHEMA",
  };
}
