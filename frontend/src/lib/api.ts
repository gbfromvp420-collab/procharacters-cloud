import type {
  CharacterId,
  CreateCustomCharacterInput,
  CreateCustomCharacterResponse,
  CreateSessionResponse,
  LiveCharacterOption,
  MediaClipKey,
  MediaOverrides,
  MemoryMessage,
  UpdateCustomCharacterInput,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function authHeaders(accountToken?: string | null): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accountToken) headers.Authorization = `Bearer ${accountToken}`;
  return headers;
}

export async function createSession(
  characterId: CharacterId,
  accountToken?: string | null,
): Promise<CreateSessionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify({ characterId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session (${res.status}): ${text}`);
  }

  return res.json() as Promise<CreateSessionResponse>;
}

export async function resumeSession(
  sessionId: string,
  token: string,
): Promise<CreateSessionResponse & { messages: MemoryMessage[] }> {
  const res = await fetch(`${API_BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to resume session (${res.status}): ${text}`);
  }

  return res.json() as Promise<CreateSessionResponse & { messages: MemoryMessage[] }>;
}

export async function resumeByCode(
  code: string,
): Promise<CreateSessionResponse & { messages: MemoryMessage[] }> {
  const res = await fetch(`${API_BASE}/api/v1/sessions/resume-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to resume code (${res.status}): ${text}`);
  }
  return res.json() as Promise<CreateSessionResponse & { messages: MemoryMessage[] }>;
}

export interface AccountAuthResponse {
  accountId: string;
  handle: string;
  token: string;
  expiresAt: string;
  email?: string;
  linked?: boolean;
}

export async function registerAccount(
  handle: string,
  passphrase: string,
): Promise<AccountAuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, passphrase }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Register failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<AccountAuthResponse>;
}

export async function loginAccount(
  handle: string,
  passphrase: string,
): Promise<AccountAuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, passphrase }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<AccountAuthResponse>;
}

export interface MagicRequestResponse {
  ok: boolean;
  email: string;
  expiresAt: string;
  delivered: boolean;
  provider: string;
  isNewAccount?: boolean;
  magicUrl?: string;
  devHint?: string;
  mailError?: string;
}

export async function requestMagicLink(email: string): Promise<MagicRequestResponse> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/magic/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Magic link request failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<MagicRequestResponse>;
}

export async function linkEmailToAccount(
  accountToken: string,
  email: string,
): Promise<MagicRequestResponse> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/link-email`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Link email failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<MagicRequestResponse>;
}

export async function verifyMagicLink(token: string): Promise<AccountAuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/magic/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Magic link verify failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<AccountAuthResponse>;
}

export async function logoutAccount(accountToken: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/accounts/logout`, {
    method: "POST",
    headers: authHeaders(accountToken),
  });
}

export interface AccountSessionSummary {
  sessionId: string;
  characterId: string;
  characterName: string;
  status: string;
  messageCount: number;
  resumeCode?: string;
  updatedAt: string;
  createdAt: string;
}

export async function listAccountSessions(
  accountToken: string,
): Promise<AccountSessionSummary[]> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/sessions`, {
    headers: authHeaders(accountToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List sessions failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { sessions: AccountSessionSummary[] };
  return data.sessions ?? [];
}

export async function claimSession(
  accountToken: string,
  sessionId: string,
): Promise<{ resumeCode?: string }> {
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/sessions/${encodeURIComponent(sessionId)}/claim`,
    { method: "POST", headers: authHeaders(accountToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claim failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ resumeCode?: string }>;
}

export async function resumeAccountSession(
  accountToken: string,
  sessionId: string,
): Promise<CreateSessionResponse & { messages: MemoryMessage[] }> {
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/sessions/${encodeURIComponent(sessionId)}/resume`,
    { method: "POST", headers: authHeaders(accountToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Account resume failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<CreateSessionResponse & { messages: MemoryMessage[] }>;
}

export async function listLiveCharacters(): Promise<LiveCharacterOption[]> {
  const res = await fetch(`${API_BASE}/api/v1/characters`);
  if (!res.ok) {
    throw new Error(`Failed to list characters (${res.status})`);
  }
  const data = (await res.json()) as { live?: LiveCharacterOption[] };
  return data.live ?? [];
}

export async function createCustomCharacter(
  input: CreateCustomCharacterInput,
): Promise<CreateCustomCharacterResponse> {
  const res = await fetch(`${API_BASE}/api/v1/characters/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create character (${res.status}): ${text}`);
  }

  return res.json() as Promise<CreateCustomCharacterResponse>;
}

export async function deleteCustomCharacter(characterId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/characters/custom/${encodeURIComponent(characterId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete character (${res.status}): ${text}`);
  }
}

export async function updateCustomCharacter(
  characterId: string,
  input: UpdateCustomCharacterInput,
): Promise<CreateCustomCharacterResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/characters/custom/${encodeURIComponent(characterId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update character (${res.status}): ${text}`);
  }
  return res.json() as Promise<CreateCustomCharacterResponse>;
}

export async function getCharacterClips(
  characterId: string,
): Promise<{ characterId: string; clips: Record<MediaClipKey, string> }> {
  const res = await fetch(
    `${API_BASE}/api/v1/characters/${encodeURIComponent(characterId)}/clips`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load clips (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ characterId: string; clips: Record<MediaClipKey, string> }>;
}

export async function uploadCharacterClip(
  characterId: string,
  emotion: MediaClipKey,
  file: File,
): Promise<{
  url: string;
  clips: Record<MediaClipKey, string>;
  mediaOverrides?: MediaOverrides;
  format?: string;
  contentType?: string;
}> {
  const { validateClipFileClient } = await import("./clip-upload");
  const check = validateClipFileClient(file);
  if (!check.ok) throw new Error(check.error);

  const body = new FormData();
  const safeName =
    file.name && /\.(mp4|webm)$/i.test(file.name)
      ? file.name
      : `${emotion}.${file.type.includes("webm") ? "webm" : "mp4"}`;
  body.append("file", file, safeName);
  const res = await fetch(
    `${API_BASE}/api/v1/characters/custom/${encodeURIComponent(characterId)}/clips/${emotion}`,
    { method: "POST", body },
  );
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string; code?: string };
      if (j.error) detail = j.code ? `${j.error} (${j.code})` : j.error;
    } catch {
      /* keep raw */
    }
    throw new Error(`Upload failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<{
    url: string;
    clips: Record<MediaClipKey, string>;
    mediaOverrides?: MediaOverrides;
    format?: string;
    contentType?: string;
  }>;
}

export async function uploadCharacterClipsBatch(
  characterId: string,
  files: File[],
): Promise<{
  uploaded: Array<{
    emotion: MediaClipKey;
    url: string;
    bytes: number;
    filename: string;
    format?: string;
    contentType?: string;
  }>;
  skipped: Array<{ filename: string; reason: string; code?: string }>;
  clips: Record<MediaClipKey, string>;
  mediaOverrides?: MediaOverrides;
}> {
  const { filterValidClipFiles } = await import("./clip-upload");
  const { accepted, rejected } = filterValidClipFiles(files);
  if (accepted.length === 0) {
    throw new Error(
      rejected.map((r) => r.reason).join(" · ") || "No valid mp4/webm files selected",
    );
  }

  const body = new FormData();
  for (const file of accepted) {
    const name = file.name || "clip.mp4";
    const base = name.toLowerCase().replace(/\.(mp4|webm)$/i, "");
    const emotions: MediaClipKey[] = ["idle", "teasing", "playful", "aroused"];
    const emotion =
      emotions.find(
        (e) =>
          base === e ||
          base.endsWith(`-${e}`) ||
          base.endsWith(`_${e}`) ||
          base.startsWith(`${e}-`) ||
          base.startsWith(`${e}_`) ||
          base.includes(e),
      ) ?? "file";
    body.append(emotion, file, name);
  }
  const res = await fetch(
    `${API_BASE}/api/v1/characters/custom/${encodeURIComponent(characterId)}/clips`,
    { method: "POST", body },
  );
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      /* keep raw */
    }
    throw new Error(`Batch upload failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    uploaded: Array<{
      emotion: MediaClipKey;
      url: string;
      bytes: number;
      filename: string;
      format?: string;
      contentType?: string;
    }>;
    skipped: Array<{ filename: string; reason: string; code?: string }>;
    clips: Record<MediaClipKey, string>;
    mediaOverrides?: MediaOverrides;
  };
  // Surface client-side rejects alongside server skips
  if (rejected.length > 0) {
    data.skipped = [
      ...rejected.map((r) => ({ filename: r.name, reason: r.reason, code: "CLIENT_REJECT" })),
      ...(data.skipped ?? []),
    ];
  }
  return data;
}

export async function fetchAccountMe(
  accountToken: string,
): Promise<{
  accountId: string;
  handle: string;
  email?: string;
  createdAt: string;
  hasPassphrase?: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me`, {
    headers: authHeaders(accountToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Account me failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    accountId: string;
    handle: string;
    email?: string;
    createdAt: string;
    hasPassphrase?: boolean;
  }>;
}

export async function setAccountPassphrase(
  accountToken: string,
  newPassphrase: string,
  currentPassphrase?: string,
): Promise<{ ok: boolean; hasPassphrase: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/passphrase`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify({ newPassphrase, currentPassphrase }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Passphrase update failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ ok: boolean; hasPassphrase: boolean }>;
}

export async function wipeAccountSessions(
  accountToken: string,
): Promise<{ ok: boolean; deleted: number }> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/sessions`, {
    method: "DELETE",
    headers: authHeaders(accountToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wipe sessions failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ ok: boolean; deleted: number }>;
}

export interface SessionExportDoc {
  schema: string;
  exportedAt: string;
  session: {
    sessionId: string;
    characterId: string;
    characterName: string;
    promptVersion: string;
    status: string;
    resumeCode?: string;
    messageCount: number;
    messages: MemoryMessage[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface AccountSessionsExportDoc {
  schema: string;
  exportedAt: string;
  accountId: string;
  handle?: string;
  sessionCount: number;
  totalMessages: number;
  sessions: SessionExportDoc["session"][];
}

/** Fetch + download one account-owned session as JSON. */
export async function exportAccountSession(
  accountToken: string,
  sessionId: string,
): Promise<{ filename: string; doc: SessionExportDoc }> {
  const { dispositionFilename, downloadJson } = await import("./download-json");
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/sessions/${encodeURIComponent(sessionId)}/export`,
    { headers: authHeaders(accountToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export failed (${res.status}): ${text}`);
  }
  const doc = (await res.json()) as SessionExportDoc;
  const day = new Date().toISOString().slice(0, 10);
  const fallback = `procharacters-chat-${sessionId.slice(0, 8)}-${day}.json`;
  const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
  downloadJson(filename, doc);
  return { filename, doc };
}

/** Fetch + download all account chats as one JSON file. */
export async function exportAllAccountSessions(
  accountToken: string,
): Promise<{ filename: string; doc: AccountSessionsExportDoc }> {
  const { dispositionFilename, downloadJson } = await import("./download-json");
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/sessions/export`, {
    headers: authHeaders(accountToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export all failed (${res.status}): ${text}`);
  }
  const doc = (await res.json()) as AccountSessionsExportDoc;
  const day = new Date().toISOString().slice(0, 10);
  const fallback = `procharacters-all-chats-${day}.json`;
  const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
  downloadJson(filename, doc);
  return { filename, doc };
}

export interface ImportSessionResult extends CreateSessionResponse {
  messages: MemoryMessage[];
  imported: {
    messageCount: number;
    originalSessionId?: string;
    originalCharacterId: string;
    characterId: string;
    truncated?: boolean;
    dropped?: number;
    bulkIndex?: number;
    bulkTotal?: number;
  };
}

/** Restore export JSON as a new live session (optional account via token). */
export async function importSessionDocument(
  document: unknown,
  options?: {
    accountToken?: string | null;
    characterId?: string;
    sessionIndex?: number;
  },
): Promise<ImportSessionResult> {
  const body: Record<string, unknown> = { document };
  if (options?.characterId) body.characterId = options.characterId;
  if (typeof options?.sessionIndex === "number") body.sessionIndex = options.sessionIndex;

  // Also accept posting the export root itself (no wrapper) for convenience
  const payload =
    document &&
    typeof document === "object" &&
    !Array.isArray(document) &&
    ("schema" in (document as object) || "session" in (document as object) || "sessions" in (document as object))
      ? options?.characterId || typeof options?.sessionIndex === "number"
        ? body
        : document
      : body;

  const res = await fetch(`${API_BASE}/api/v1/sessions/import`, {
    method: "POST",
    headers: authHeaders(options?.accountToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string; code?: string };
      if (j.error) detail = j.code ? `${j.error} (${j.code})` : j.error;
    } catch {
      /* keep raw */
    }
    throw new Error(`Import failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<ImportSessionResult>;
}

/** Account-owned import (always attaches to signed-in account). */
export async function importAccountSession(
  accountToken: string,
  document: unknown,
  options?: { characterId?: string; sessionIndex?: number },
): Promise<ImportSessionResult> {
  const body: Record<string, unknown> = { document };
  if (options?.characterId) body.characterId = options.characterId;
  if (typeof options?.sessionIndex === "number") body.sessionIndex = options.sessionIndex;

  const res = await fetch(`${API_BASE}/api/v1/accounts/me/sessions/import`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify(
      document &&
        typeof document === "object" &&
        !options?.characterId &&
        typeof options?.sessionIndex !== "number" &&
        ("schema" in (document as object) || "session" in (document as object))
        ? document
        : body,
    ),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string; code?: string };
      if (j.error) detail = j.code ? `${j.error} (${j.code})` : j.error;
    } catch {
      /* keep raw */
    }
    throw new Error(`Import failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<ImportSessionResult>;
}

/** Export active/guest chat via session token (no account required). */
export async function exportLiveSession(
  sessionId: string,
  wsToken: string,
): Promise<{ filename: string; doc: SessionExportDoc }> {
  const { dispositionFilename, downloadJson } = await import("./download-json");
  const res = await fetch(
    `${API_BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/export`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: wsToken }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export failed (${res.status}): ${text}`);
  }
  const doc = (await res.json()) as SessionExportDoc;
  const day = new Date().toISOString().slice(0, 10);
  const fallback = `procharacters-chat-${sessionId.slice(0, 8)}-${day}.json`;
  const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
  downloadJson(filename, doc);
  return { filename, doc };
}

export async function deleteAccountSession(
  accountToken: string,
  sessionId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE", headers: authHeaders(accountToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete session failed (${res.status}): ${text}`);
  }
}

export async function deleteAccount(
  accountToken: string,
): Promise<{ ok: boolean; sessionsWiped: number }> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me`, {
    method: "DELETE",
    headers: authHeaders(accountToken),
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete account failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ ok: boolean; sessionsWiped: number }>;
}

export function getApiBase(): string {
  return API_BASE;
}
