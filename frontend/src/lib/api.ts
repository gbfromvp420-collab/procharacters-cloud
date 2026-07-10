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
}> {
  const body = new FormData();
  body.append("file", file, file.name || `${emotion}.mp4`);
  const res = await fetch(
    `${API_BASE}/api/v1/characters/custom/${encodeURIComponent(characterId)}/clips/${emotion}`,
    { method: "POST", body },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    url: string;
    clips: Record<MediaClipKey, string>;
    mediaOverrides?: MediaOverrides;
  }>;
}

export function getApiBase(): string {
  return API_BASE;
}
