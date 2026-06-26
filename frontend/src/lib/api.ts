import type { CharacterId, CreateSessionResponse } from "./types";

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

export function getApiBase(): string {
  return API_BASE;
}