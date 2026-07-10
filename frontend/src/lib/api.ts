import type {
  CharacterId,
  CreateCustomCharacterInput,
  CreateCustomCharacterResponse,
  CreateSessionResponse,
  LiveCharacterOption,
  MediaClipKey,
  MemoryMessage,
  UpdateCustomCharacterInput,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function createSession(characterId: CharacterId): Promise<CreateSessionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export function getApiBase(): string {
  return API_BASE;
}
