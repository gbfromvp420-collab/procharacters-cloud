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

/** Thrown when a stored account bearer token is rejected (401/403). */
export class AccountAuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AccountAuthError";
    this.status = status;
  }
}

export function isAccountAuthError(error: unknown): error is AccountAuthError {
  return error instanceof AccountAuthError;
}

function throwIfAuthFailed(res: Response, text: string, fallback: string): void {
  if (res.status === 401 || res.status === 403) {
    throw new AccountAuthError(
      "Session expired — sign in again to sync chats.",
      res.status,
    );
  }
  throw new Error(`${fallback} (${res.status}): ${text}`);
}

export async function createSession(
  characterId: CharacterId,
  accountToken?: string | null,
  options?: {
    messageWindow?: 20 | 30 | 50 | 80;
    useCrossSessionMemory?: boolean;
    sessionMode?: "normal" | "edge_pace";
  },
): Promise<CreateSessionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify({
      characterId,
      ...(options?.messageWindow ? { messageWindow: options.messageWindow } : {}),
      ...(options?.useCrossSessionMemory ? { useCrossSessionMemory: true } : {}),
      ...(options?.sessionMode ? { sessionMode: options.sessionMode } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session (${res.status}): ${text}`);
  }

  return res.json() as Promise<CreateSessionResponse>;
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
): Promise<{
  optIn: boolean;
  notes: string;
  neverConfigured?: boolean;
  hasDurable?: boolean;
  updatedAt?: string | null;
}> {
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/memory/${encodeURIComponent(characterId)}`,
    { headers: authHeaders(accountToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Memory status failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    optIn: boolean;
    notes: string;
    neverConfigured?: boolean;
    hasDurable?: boolean;
    updatedAt?: string | null;
  }>;
}

/** Wipe long-term dossier for this character. optOut also turns Remember off. */
export async function clearCrossSessionMemory(
  accountToken: string,
  characterId: string,
  options?: { optOut?: boolean },
): Promise<{ cleared: boolean; optIn: boolean; notes: string }> {
  const q = options?.optOut ? "?optOut=1" : "";
  const res = await fetch(
    `${API_BASE}/api/v1/accounts/me/memory/${encodeURIComponent(characterId)}${q}`,
    {
      method: "DELETE",
      headers: authHeaders(accountToken),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forget memory failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ cleared: boolean; optIn: boolean; notes: string }>;
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
  options?: { sessionMode?: "normal" | "edge_pace" },
): Promise<
  CreateSessionResponse & {
    messages: MemoryMessage[];
    sessionNotes?: string;
    priorNotes?: string;
    rehydrate?: boolean;
    sceneLock?: string;
  }
> {
  const res = await fetch(`${API_BASE}/api/v1/sessions/resume-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      ...(options?.sessionMode ? { sessionMode: options.sessionMode } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to resume code (${res.status}): ${text}`);
  }
  return res.json() as Promise<
    CreateSessionResponse & {
      messages: MemoryMessage[];
      sessionNotes?: string;
      priorNotes?: string;
      rehydrate?: boolean;
      sceneLock?: string;
    }
  >;
}

/** Full memory dump after resume — forces UI + next turn continuity. */
export async function fetchSessionMemory(
  sessionId: string,
  wsToken: string,
): Promise<{
  messageCount: number;
  recentMessages: MemoryMessage[];
  sessionNotes?: string;
  priorNotes?: string;
  messageWindow?: number;
  characterId?: string;
  characterName?: string;
  status?: string;
}> {
  const url = new URL(
    `${API_BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/memory`,
  );
  url.searchParams.set("token", wsToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Session memory failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    messageCount: number;
    recentMessages: MemoryMessage[];
    sessionNotes?: string;
    priorNotes?: string;
    messageWindow?: number;
    characterId?: string;
    characterName?: string;
    status?: string;
  }>;
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
    body: "{}",
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
    throwIfAuthFailed(res, text, "List sessions failed");
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
      resumeExpiresAt: data.resumeExpiresAt,
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

/** Format retry-after seconds for rate-limit UX (e.g. "45s", "2 min"). */
export function formatRetryAfter(sec: number): string {
  const s = Math.max(1, Math.ceil(sec));
  if (s < 60) return `${s}s`;
  const min = Math.ceil(s / 60);
  return min === 1 ? "1 min" : `${min} min`;
}

/** One-shot test notification (phone smoke). */
export async function sendTestPush(accountToken: string): Promise<{
  ok: boolean;
  sent: number;
  failed?: number;
  gone?: number;
  devices?: number;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me/push/test`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: "{}",
  });
  const text = await res.text();
  let data: {
    ok?: boolean;
    sent?: number;
    failed?: number;
    gone?: number;
    devices?: number;
    error?: string;
    retryAfterSec?: number;
    code?: string;
  } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    // 429: show clear "try again in Ns" so spam-taps don't look broken
    if (res.status === 429) {
      const headerRetry = Number(res.headers.get("Retry-After") || 0);
      const retryAfterSec =
        (typeof data.retryAfterSec === "number" && data.retryAfterSec > 0
          ? data.retryAfterSec
          : 0) ||
        (Number.isFinite(headerRetry) && headerRetry > 0 ? headerRetry : 0) ||
        60;
      throw new Error(
        `Too many test alerts — try again in ${formatRetryAfter(retryAfterSec)}`,
      );
    }
    throw new Error(data.error || text || `Test push failed (${res.status})`);
  }
  return {
    ok: data.ok === true,
    sent: data.sent ?? 0,
    failed: data.failed,
    gone: data.gone,
    devices: data.devices,
    error: data.error,
  };
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
  resumeExpiresAt?: string;
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
    resumeExpiresAt?: string;
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
        resumeExpiresAt: data.resumeExpiresAt,
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

/** Studio Forge v3 — natural language fantasy → full DNA + form fields. */
export async function forgeExpandFantasy(input: {
  fantasy: string;
  baseModelId?: string;
  displayNameHint?: string;
  audience?: "gay" | "bi" | "straight" | "any";
}): Promise<import("./forge-dna").ForgeExpandResponse> {
  const res = await fetch(`${API_BASE}/api/v1/characters/forge/expand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Forge failed (${res.status})`;
    try {
      const j = JSON.parse(text) as { error?: string; retryAfterSec?: number };
      if (typeof j.error === "string") msg = j.error;
      if (j.retryAfterSec) msg += ` · retry in ${j.retryAfterSec}s`;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }
  return res.json() as Promise<import("./forge-dna").ForgeExpandResponse>;
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
  accountToken?: string | null,
): Promise<CreateCustomCharacterResponse> {
  if (!accountToken) {
    throw new Error("Sign in to edit a My Character");
  }
  const res = await fetch(
    `${API_BASE}/api/v1/characters/custom/${encodeURIComponent(characterId)}`,
    {
      method: "PATCH",
      headers: authHeaders(accountToken),
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
  accountToken?: string | null,
): Promise<{
  url: string;
  clips: Record<MediaClipKey, string>;
  mediaOverrides?: MediaOverrides;
  format?: string;
  contentType?: string;
}> {
  if (!accountToken) {
    throw new Error("Sign in to upload clips for a My Character");
  }
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
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accountToken}` },
      body,
    },
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
  accountToken?: string | null,
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
  if (!accountToken) {
    throw new Error("Sign in to upload clips for a My Character");
  }
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
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accountToken}` },
      body,
    },
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
  plan?: string;
  activePremium?: boolean;
  planExpiresAt?: string;
  customsLimit?: number;
}> {
  const res = await fetch(`${API_BASE}/api/v1/accounts/me`, {
    headers: authHeaders(accountToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throwIfAuthFailed(res, text, "Account me failed");
  }
  return res.json() as Promise<{
    accountId: string;
    handle: string;
    email?: string;
    createdAt: string;
    hasPassphrase?: boolean;
    plan?: string;
    activePremium?: boolean;
    planExpiresAt?: string;
    customsLimit?: number;
  }>;
}

/**
 * Probe stored bearer token. On 401/403 clears local auth and sets re-login notice.
 * Returns me payload when valid, null when missing/invalid.
 */
export async function validateStoredAccountSession(): Promise<{
  valid: boolean;
  handle?: string;
  notice?: string | null;
}> {
  const { loadStoredAccount, invalidateStoredAccount, DEFAULT_REAUTH_NOTICE } =
    await import("./account-storage");
  const stored = loadStoredAccount();
  if (!stored) {
    return { valid: false, notice: null };
  }
  try {
    const me = await fetchAccountMe(stored.token);
    return { valid: true, handle: me.handle };
  } catch (error) {
    if (isAccountAuthError(error)) {
      invalidateStoredAccount(DEFAULT_REAUTH_NOTICE);
      return { valid: false, notice: DEFAULT_REAUTH_NOTICE };
    }
    // Network blip — keep local session
    return { valid: true, handle: stored.handle };
  }
}

export type BillingProductId = "day_pass" | "supporter";

export interface BillingCatalogProduct {
  id: BillingProductId;
  name: string;
  description: string;
  amountCents: number;
  currency: string;
}

export async function fetchBillingCatalog(): Promise<{
  configured: boolean;
  webhookConfigured?: boolean;
  mode?: "test" | "live" | "off";
  products: BillingCatalogProduct[];
}> {
  const res = await fetch(`${API_BASE}/api/v1/billing/catalog`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Billing catalog failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    configured: boolean;
    webhookConfigured?: boolean;
    mode?: "test" | "live" | "off";
    products: BillingCatalogProduct[];
  }>;
}

export function formatUsdCents(cents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export async function fetchBillingStatus(accountToken: string): Promise<{
  configured: boolean;
  webhookConfigured?: boolean;
  mode?: "test" | "live" | "off";
  plan: string;
  activePremium: boolean;
  planExpiresAt?: string;
  customsLimit: number;
  freePath: boolean;
  benefits: {
    free: { customsLimit: number; label: string };
    premium: { customsLimit: number; label: string };
  };
}> {
  const res = await fetch(`${API_BASE}/api/v1/billing/status`, {
    headers: authHeaders(accountToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Billing status failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    configured: boolean;
    webhookConfigured?: boolean;
    mode?: "test" | "live" | "off";
    plan: string;
    activePremium: boolean;
    planExpiresAt?: string;
    customsLimit: number;
    freePath: boolean;
    benefits: {
      free: { customsLimit: number; label: string };
      premium: { customsLimit: number; label: string };
    };
  }>;
}

export async function startBillingCheckout(
  accountToken: string,
  product: "day_pass" | "supporter" = "day_pass",
): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(`${API_BASE}/api/v1/billing/checkout`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify({ product }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Checkout failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ url: string; sessionId: string }>;
}

/** Apply paid Checkout Session on return page (backup if webhook is slow). */
export async function confirmBillingCheckout(
  accountToken: string,
  sessionId: string,
): Promise<{
  ok: boolean;
  plan?: string;
  activePremium?: boolean;
  planExpiresAt?: string;
  customsLimit?: number;
}> {
  const res = await fetch(`${API_BASE}/api/v1/billing/confirm`, {
    method: "POST",
    headers: authHeaders(accountToken),
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confirm billing failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    ok: boolean;
    plan?: string;
    activePremium?: boolean;
    planExpiresAt?: string;
    customsLimit?: number;
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
