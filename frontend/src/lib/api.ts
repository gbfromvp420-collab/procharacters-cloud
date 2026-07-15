import type {
  CharacterId,
  BaseModelPrefill,
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
  options?: {
    messageWindow?: 20 | 30 | 50 | 80;
    useCrossSessionMemory?: boolean;
  },
): Promise<CreateSessionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify({
      characterId,
      ...(options?.messageWindow ? { messageWindow: options.messageWindow } : {}),
      ...(options?.useCrossSessionMemory ? { useCrossSessionMemory: true } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session (${res.status}): ${text}`);
  }

  return res.json() as Promise<CreateSessionResponse>;
}

export async function fetchSessionMemory(
  sessionId: string,
  token?: string | null,
): Promise<{
  messageCount: number;
  sessionNotes?: string;
  priorNotes?: string;
  messageWindow?: number;
  characterName?: string;
}> {
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  const res = await fetch(
    `${API_BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/memory${q}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Memory fetch failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    messageCount: number;
    sessionNotes?: string;
    priorNotes?: string;
    messageWindow?: number;
    characterName?: string;
  }>;
}

export async function setCrossSessionMemoryOptIn(
  accountToken: string,
  characterId: string,
  optIn: boolean,
): Promise<{ optIn: boolean; notes: string }> {
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/memory/${encodeURIComponent(characterId)}`,
    {
      method: "PUT",
      headers: authHeaders(accountToken),
      body: JSON.stringify({ optIn }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Memory opt-in failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ optIn: boolean; notes: string }>;
}

export async function getCrossSessionMemoryOptIn(
  accountToken: string,
  characterId: string,
): Promise<{ optIn: boolean; notes: string }> {
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/memory/${encodeURIComponent(characterId)}`,
    { headers: authHeaders(accountToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Memory status failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ optIn: boolean; notes: string }>;
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
  /** When the current resume code expires (server may auto-mint after). */
  resumeExpiresAt?: string;
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
  const sessions = data.sessions ?? [];
  // Keep local resume cache warm for card share / multi-device
  try {
    const { syncResumeCacheFromAccountSessions } = await import("./resume-cache");
    syncResumeCacheFromAccountSessions(sessions);
  } catch {
    /* ignore */
  }
  return sessions;
}

/** Force-mint a new resume code for one session (invalidates the old link). */
export async function refreshAccountSessionResume(
  accountToken: string,
  sessionId: string,
): Promise<{ sessionId: string; resumeCode: string; resumeExpiresAt: string }> {
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/sessions/${encodeURIComponent(sessionId)}/refresh-resume`,
    { method: "POST", headers: authHeaders(accountToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh resume failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    sessionId: string;
    resumeCode: string;
    resumeExpiresAt: string;
  };
  try {
    const { rememberLocalResume } = await import("./resume-cache");
    rememberLocalResume({
      characterId: "", // filled by caller if known
      sessionId: data.sessionId,
      resumeCode: data.resumeCode,
    });
  } catch {
    /* ignore */
  }
  return data;
}

/** Rotate resume codes on the account (all, or only expiring/expired). */
export async function refreshAllAccountResumes(
  accountToken: string,
  options?: { onlyExpiring?: boolean; withinDays?: number },
): Promise<{
  refreshed: number;
  skipped?: number;
  onlyExpiring?: boolean;
  sessions: Array<{ sessionId: string; resumeCode: string; resumeExpiresAt: string }>;
}> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/sessions/refresh-resumes`, {
    method: "POST",
    headers: {
      ...authHeaders(accountToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      onlyExpiring: options?.onlyExpiring === true,
      withinDays: options?.withinDays,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh all resumes failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    refreshed: number;
    skipped?: number;
    onlyExpiring?: boolean;
    sessions: Array<{ sessionId: string; resumeCode: string; resumeExpiresAt: string }>;
  }>;
}

/** Web Push subscription status for Account UI. */
export async function fetchPushStatus(accountToken: string): Promise<{
  configured: boolean;
  subscriptionCount: number;
  lastExpiryNotifyAt: string | null;
  devices: Array<{
    endpointTail: string;
    createdAt: string;
    lastExpiryNotifyAt: string | null;
    userAgent: string | null;
  }>;
}> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/push/status`, {
    headers: authHeaders(accountToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Push status failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    configured: boolean;
    subscriptionCount: number;
    lastExpiryNotifyAt: string | null;
    devices: Array<{
      endpointTail: string;
      createdAt: string;
      lastExpiryNotifyAt: string | null;
      userAgent: string | null;
    }>;
  }>;
}

/** Ask server to re-check expiring codes and push if needed. */
export async function checkPushExpiry(
  accountToken: string,
  options?: { force?: boolean },
): Promise<{ sent: number; skipped: number; configured: boolean; expiring?: number }> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/push/check-expiry`, {
    method: "POST",
    headers: {
      ...authHeaders(accountToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ force: options?.force === true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Push check-expiry failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    sent: number;
    skipped: number;
    configured: boolean;
    expiring?: number;
  }>;
}

/** Email all resume links to the account's linked email. */
export async function emailAccountResumeLinks(accountToken: string): Promise<{
  ok: boolean;
  email: string;
  count: number;
  delivered: boolean;
  provider: string;
  mailError?: string;
  preview?: Array<{ characterName: string; resumeCode: string; resumeUrl: string }>;
  devHint?: string;
}> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/sessions/email-resumes`, {
    method: "POST",
    headers: authHeaders(accountToken),
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
    throw new Error(detail || `Email resumes failed (${res.status})`);
  }
  return res.json() as Promise<{
    ok: boolean;
    email: string;
    count: number;
    delivered: boolean;
    provider: string;
    mailError?: string;
    preview?: Array<{ characterName: string; resumeCode: string; resumeUrl: string }>;
    devHint?: string;
  }>;
}

/** Latest account-owned chat for a character (includes resume code). */
export async function fetchLatestAccountSessionForCharacter(
  accountToken: string,
  characterId: string,
): Promise<{
  sessionId: string;
  characterId: string;
  characterName: string;
  resumeCode?: string;
  messageCount: number;
  status: string;
  updatedAt: string;
} | null> {
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/characters/${encodeURIComponent(characterId)}/latest`,
    { headers: authHeaders(accountToken) },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Latest session failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    sessionId: string;
    characterId: string;
    characterName: string;
    resumeCode?: string;
    messageCount: number;
    status: string;
    updatedAt: string;
  };
  if (data.resumeCode) {
    try {
      const { rememberLocalResume } = await import("./resume-cache");
      rememberLocalResume({
        characterId: data.characterId,
        characterName: data.characterName,
        sessionId: data.sessionId,
        resumeCode: data.resumeCode,
      });
    } catch {
      /* ignore */
    }
  }
  return data;
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

export async function listLiveCharacters(
  accountToken?: string | null,
): Promise<LiveCharacterOption[]> {
  const res = await fetch(`${API_BASE}/api/v1/characters`, {
    headers: accountToken ? authHeaders(accountToken) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to list characters (${res.status})`);
  }
  const data = (await res.json()) as { live?: LiveCharacterOption[] };
  return data.live ?? [];
}

export async function createCustomCharacter(
  input: CreateCustomCharacterInput,
  accountToken?: string | null,
): Promise<CreateCustomCharacterResponse> {
  if (!accountToken) {
    throw new Error("Sign in to save a My Character");
  }
  const res = await fetch(`${API_BASE}/api/v1/characters/custom`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create My Character (${res.status}): ${text}`);
  }

  return res.json() as Promise<CreateCustomCharacterResponse>;
}

export async function fetchBaseModelPrefill(
  baseModelId: string,
): Promise<import("./types").BaseModelPrefill> {
  const res = await fetch(
    `${API_BASE}/api/v1/characters/${encodeURIComponent(baseModelId)}/prefill`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prefill failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<import("./types").BaseModelPrefill>;
}

export async function deleteCustomCharacter(
  characterId: string,
  accountToken?: string | null,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/characters/custom/${encodeURIComponent(characterId)}`,
    {
      method: "DELETE",
      headers: accountToken ? authHeaders(accountToken) : undefined,
    },
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

export type SessionExportFormat = "json" | "md";

/** Fetch one account-owned session export (optionally download). */
export async function exportAccountSession(
  accountToken: string,
  sessionId: string,
  format: SessionExportFormat = "json",
  options?: { download?: boolean },
): Promise<{ filename: string; doc?: SessionExportDoc; markdown?: string }> {
  const download = options?.download !== false;
  const { dispositionFilename, downloadJson, downloadMarkdown } = await import("./download-json");
  const qs = format === "md" ? "?format=md" : "";
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/sessions/${encodeURIComponent(sessionId)}/export${qs}`,
    { headers: authHeaders(accountToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export failed (${res.status}): ${text}`);
  }
  const day = new Date().toISOString().slice(0, 10);
  if (format === "md") {
    const markdown = await res.text();
    const fallback = `procharacters-chat-${sessionId.slice(0, 8)}-${day}.md`;
    const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
    if (download) downloadMarkdown(filename, markdown);
    return { filename, markdown };
  }
  const doc = (await res.json()) as SessionExportDoc;
  const fallback = `procharacters-chat-${sessionId.slice(0, 8)}-${day}.json`;
  const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
  if (download) downloadJson(filename, doc);
  return { filename, doc };
}

/** Fetch all account chats export (optionally download). */
export async function exportAllAccountSessions(
  accountToken: string,
  format: SessionExportFormat = "json",
  options?: { download?: boolean },
): Promise<{ filename: string; doc?: AccountSessionsExportDoc; markdown?: string }> {
  const download = options?.download !== false;
  const { dispositionFilename, downloadJson, downloadMarkdown } = await import("./download-json");
  const qs = format === "md" ? "?format=md" : "";
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/sessions/export${qs}`, {
    headers: authHeaders(accountToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export all failed (${res.status}): ${text}`);
  }
  const day = new Date().toISOString().slice(0, 10);
  if (format === "md") {
    const markdown = await res.text();
    const fallback = `procharacters-all-chats-${day}.md`;
    const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
    if (download) downloadMarkdown(filename, markdown);
    return { filename, markdown };
  }
  const doc = (await res.json()) as AccountSessionsExportDoc;
  const fallback = `procharacters-all-chats-${day}.json`;
  const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
  if (download) downloadJson(filename, doc);
  return { filename, doc };
}

/** Fetch markdown only (no file download) — for clipboard. */
export async function fetchAccountSessionMarkdown(
  accountToken: string,
  sessionId: string,
): Promise<string> {
  const { markdown } = await exportAccountSession(accountToken, sessionId, "md", {
    download: false,
  });
  if (!markdown?.trim()) throw new Error("Empty transcript");
  return markdown;
}

export async function fetchAllAccountSessionsMarkdown(accountToken: string): Promise<string> {
  const { markdown } = await exportAllAccountSessions(accountToken, "md", { download: false });
  if (!markdown?.trim()) throw new Error("Empty archive");
  return markdown;
}

export interface ImportSessionResult extends CreateSessionResponse {
  messages: MemoryMessage[];
  imported: {
    messageCount: number;
    originalSessionId?: string;
    originalCharacterId: string;
    characterId: string;
    remappedFrom?: string;
    truncated?: boolean;
    dropped?: number;
    bulkIndex?: number;
    bulkTotal?: number;
  };
  /** Present when a multi-session account export was restored. */
  bulk?: {
    total: number;
    succeeded: number;
    failed: number;
    capped: boolean;
    totalMessages: number;
    results: Array<
      | {
          ok: true;
          index: number;
          sessionId: string;
          characterId: string;
          characterName: string;
          messageCount: number;
          resumeCode?: string;
          remappedFrom?: string;
        }
      | {
          ok: false;
          index: number;
          characterId?: string;
          characterName?: string;
          error: string;
          code?: string;
        }
    >;
  };
}

function importFlashSummary(result: ImportSessionResult): string {
  if (result.bulk && result.bulk.succeeded + result.bulk.failed > 1) {
    const { succeeded, failed, totalMessages, capped, results } = result.bulk;
    const remapped = results.filter((r) => r.ok && r.remappedFrom).length;
    const failPart = failed > 0 ? `, ${failed} failed` : "";
    const remapPart = remapped > 0 ? `, ${remapped} remapped` : "";
    const capPart = capped ? " (capped)" : "";
    return `Imported ${succeeded} chat(s), ${totalMessages} msgs${remapPart}${failPart}${capPart}`;
  }
  if (result.imported.remappedFrom) {
    return `Imported ${result.imported.messageCount} msgs (remapped ${result.imported.remappedFrom} → ${result.imported.characterId})`;
  }
  return `Imported ${result.imported.messageCount} msgs`;
}

export { importFlashSummary };

/** Restore export JSON as a new live session (optional account via token). */
export type ImportCharacterOptions = {
  characterId?: string;
  characterMap?: Record<string, string>;
  fallbackCharacterId?: string;
  sessionIndex?: number;
  /** Default true for bulk account exports when sessionIndex omitted. */
  importAll?: boolean;
  /** When importAll, which export index becomes the primary live session. */
  openIndex?: number;
};

export type ImportPreviewSession = {
  index: number;
  ok: boolean;
  characterName: string;
  originalCharacterId: string;
  characterId?: string;
  remappedFrom?: string;
  messageCount: number;
  truncated?: boolean;
  dropped?: number;
  error?: string;
  code?: string;
};

export type ImportPreviewCharacter = {
  id: string;
  name: string;
  sessionCount: number;
  available: boolean;
  resolvedTo?: string;
  remapped: boolean;
  error?: string;
};

export type ImportPreview = {
  dryRun: true;
  sourceSchema: string;
  bulkTotal: number;
  entriesParsed: number;
  capped: boolean;
  willSucceed: number;
  willFail: number;
  totalMessages: number;
  sessions: ImportPreviewSession[];
  characters: ImportPreviewCharacter[];
};

/** Dry-run import (no sessions written). */
export async function previewImportDocument(
  document: unknown,
  options?: {
    accountToken?: string | null;
  } & ImportCharacterOptions,
): Promise<ImportPreview> {
  const body: Record<string, unknown> = { document };
  if (options?.characterId) body.characterId = options.characterId;
  if (options?.characterMap && Object.keys(options.characterMap).length > 0) {
    body.characterMap = options.characterMap;
  }
  if (options?.fallbackCharacterId) body.fallbackCharacterId = options.fallbackCharacterId;
  if (typeof options?.sessionIndex === "number") body.sessionIndex = options.sessionIndex;
  if (typeof options?.importAll === "boolean") body.importAll = options.importAll;
  else if (typeof options?.sessionIndex !== "number") body.importAll = true;

  const path = options?.accountToken
    ? `${API_BASE}/api/v1/accounts/me/sessions/import/preview`
    : `${API_BASE}/api/v1/sessions/import/preview`;

  const res = await fetch(path, {
    method: "POST",
    headers: authHeaders(options?.accountToken),
    body: JSON.stringify(body),
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
    throw new Error(`Import preview failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<ImportPreview>;
}

export async function importSessionDocument(
  document: unknown,
  options?: {
    accountToken?: string | null;
  } & ImportCharacterOptions,
): Promise<ImportSessionResult> {
  const body: Record<string, unknown> = { document };
  if (options?.characterId) body.characterId = options.characterId;
  if (options?.characterMap && Object.keys(options.characterMap).length > 0) {
    body.characterMap = options.characterMap;
  }
  if (options?.fallbackCharacterId) body.fallbackCharacterId = options.fallbackCharacterId;
  if (typeof options?.sessionIndex === "number") body.sessionIndex = options.sessionIndex;
  if (typeof options?.importAll === "boolean") body.importAll = options.importAll;
  if (typeof options?.openIndex === "number") body.openIndex = options.openIndex;

  // Prefer wrapper when we need flags; raw export only when no options
  const needsWrapper =
    !!options?.characterId ||
    !!options?.fallbackCharacterId ||
    !!(options?.characterMap && Object.keys(options.characterMap).length > 0) ||
    typeof options?.sessionIndex === "number" ||
    typeof options?.importAll === "boolean" ||
    typeof options?.openIndex === "number";

  const payload =
    document &&
    typeof document === "object" &&
    !Array.isArray(document) &&
    ("schema" in (document as object) ||
      "session" in (document as object) ||
      "sessions" in (document as object)) &&
    !needsWrapper
      ? document
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

/** Account-owned import — bulk exports restore every chat by default. */
export async function importAccountSession(
  accountToken: string,
  document: unknown,
  options?: ImportCharacterOptions,
): Promise<ImportSessionResult> {
  const body: Record<string, unknown> = { document };
  if (options?.characterId) body.characterId = options.characterId;
  if (options?.characterMap && Object.keys(options.characterMap).length > 0) {
    body.characterMap = options.characterMap;
  }
  if (options?.fallbackCharacterId) body.fallbackCharacterId = options.fallbackCharacterId;
  if (typeof options?.sessionIndex === "number") body.sessionIndex = options.sessionIndex;
  if (typeof options?.importAll === "boolean") body.importAll = options.importAll;
  else if (typeof options?.sessionIndex !== "number") body.importAll = true;
  if (typeof options?.openIndex === "number") body.openIndex = options.openIndex;

  const res = await fetch(`${API_BASE}/api/v1/accounts/me/sessions/import`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify(body),
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
  format: SessionExportFormat = "json",
  options?: { download?: boolean },
): Promise<{ filename: string; doc?: SessionExportDoc; markdown?: string }> {
  const download = options?.download !== false;
  const { dispositionFilename, downloadJson, downloadMarkdown } = await import("./download-json");
  const res = await fetch(
    `${API_BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/export`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: wsToken, format }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export failed (${res.status}): ${text}`);
  }
  const day = new Date().toISOString().slice(0, 10);
  if (format === "md") {
    const markdown = await res.text();
    const fallback = `procharacters-chat-${sessionId.slice(0, 8)}-${day}.md`;
    const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
    if (download) downloadMarkdown(filename, markdown);
    return { filename, markdown };
  }
  const doc = (await res.json()) as SessionExportDoc;
  const fallback = `procharacters-chat-${sessionId.slice(0, 8)}-${day}.json`;
  const filename = dispositionFilename(res.headers.get("Content-Disposition"), fallback);
  if (download) downloadJson(filename, doc);
  return { filename, doc };
}

/** Fetch live session markdown only (no download) — for clipboard. */
export async function fetchLiveSessionMarkdown(
  sessionId: string,
  wsToken: string,
): Promise<string> {
  const { markdown } = await exportLiveSession(sessionId, wsToken, "md", { download: false });
  if (!markdown?.trim()) throw new Error("Empty transcript");
  return markdown;
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
