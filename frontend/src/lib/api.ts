import type {
  AuthResponse,
  AuthUser,
  CharacterId,
  CommandDefinition,
  CreateSessionResponse,
  GiftDefinition,
  LiveRoomListItem,
  ScheduledShow,
  TierConfig,
  Tip,
  TipLeaderboardEntry,
  TokenBalance,
  TokenCosts,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/* ── Auth API ───────────────────────────────────────────── */

export async function register(
  email: string,
  username: string,
  password: string,
  displayName?: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password, displayName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Registration failed (${res.status})`);
  }
  return res.json() as Promise<AuthResponse>;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Login failed (${res.status})`);
  }
  return res.json() as Promise<AuthResponse>;
}

export async function getMe(token: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    throw new Error("Not authenticated");
  }
  return res.json() as Promise<{ user: AuthUser }>;
}

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

/* ── Token / Credits API ────────────────────────────────── */

export async function getTokenBalance(userId: string): Promise<{ balance: TokenBalance; costs: TokenCosts }> {
  const res = await fetch(`${API_BASE}/api/v1/tokens/${userId}/balance`);
  if (!res.ok) throw new Error(`Failed to get balance: ${res.status}`);
  return res.json() as Promise<{ balance: TokenBalance; costs: TokenCosts }>;
}

export async function creditTokens(userId: string, amount: number): Promise<{ balance: TokenBalance }> {
  const res = await fetch(`${API_BASE}/api/v1/tokens/${userId}/credit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, type: "purchase" }),
  });
  if (!res.ok) throw new Error(`Failed to credit tokens: ${res.status}`);
  return res.json() as Promise<{ balance: TokenBalance }>;
}

export async function getTiers(): Promise<{ tiers: TierConfig[] }> {
  const res = await fetch(`${API_BASE}/api/v1/tokens/tiers`);
  if (!res.ok) throw new Error(`Failed to get tiers: ${res.status}`);
  return res.json() as Promise<{ tiers: TierConfig[] }>;
}

/* ── Live Cam API ───────────────────────────────────────── */

export async function listLiveRooms(status?: string): Promise<{ rooms: LiveRoomListItem[] }> {
  const url = status
    ? `${API_BASE}/api/v1/livecam/rooms?status=${status}`
    : `${API_BASE}/api/v1/livecam/rooms`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to list rooms: ${res.status}`);
  return res.json() as Promise<{ rooms: LiveRoomListItem[] }>;
}

export async function sendTip(
  roomId: string,
  userId: string,
  displayName: string,
  amount: number,
  message?: string,
): Promise<{ tip: Tip }> {
  const res = await fetch(`${API_BASE}/api/v1/livecam/rooms/${roomId}/tip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, displayName, amount, message }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tip failed: ${text}`);
  }
  return res.json() as Promise<{ tip: Tip }>;
}

export async function sendGift(
  roomId: string,
  userId: string,
  displayName: string,
  giftId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/livecam/rooms/${roomId}/gift`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, displayName, giftId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gift failed: ${text}`);
  }
}

export async function sendCommand(
  roomId: string,
  userId: string,
  displayName: string,
  commandId: string,
  customPrompt?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/livecam/rooms/${roomId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, displayName, commandId, customPrompt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Command failed: ${text}`);
  }
}

export async function getGiftCatalog(): Promise<{ gifts: GiftDefinition[] }> {
  const res = await fetch(`${API_BASE}/api/v1/livecam/gifts`);
  if (!res.ok) throw new Error(`Failed to get gifts: ${res.status}`);
  return res.json() as Promise<{ gifts: GiftDefinition[] }>;
}

export async function getCommandCatalog(): Promise<{ commands: CommandDefinition[] }> {
  const res = await fetch(`${API_BASE}/api/v1/livecam/commands`);
  if (!res.ok) throw new Error(`Failed to get commands: ${res.status}`);
  return res.json() as Promise<{ commands: CommandDefinition[] }>;
}

export async function getTipLeaderboard(roomId: string): Promise<{ leaderboard: TipLeaderboardEntry[] }> {
  const res = await fetch(`${API_BASE}/api/v1/livecam/rooms/${roomId}/tips/leaderboard`);
  if (!res.ok) throw new Error(`Failed to get leaderboard: ${res.status}`);
  return res.json() as Promise<{ leaderboard: TipLeaderboardEntry[] }>;
}

export async function listScheduledShows(status?: string): Promise<{ shows: ScheduledShow[] }> {
  const url = status
    ? `${API_BASE}/api/v1/livecam/shows?status=${status}`
    : `${API_BASE}/api/v1/livecam/shows`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to list shows: ${res.status}`);
  return res.json() as Promise<{ shows: ScheduledShow[] }>;
}

export async function joinRoom(roomId: string, userId: string): Promise<{ viewerCount: number }> {
  const res = await fetch(`${API_BASE}/api/v1/livecam/rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`Failed to join room: ${res.status}`);
  return res.json() as Promise<{ viewerCount: number }>;
}