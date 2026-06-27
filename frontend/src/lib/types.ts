export type CharacterId = "twink-default" | "female-default";

export interface LiveKitJoinInfo {
  url: string;
  token: string;
  roomName: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  wsToken: string;
  characterId: string;
  promptVersion: string;
  wsUrl: string;
  avatarState: AvatarState;
  livekit?: LiveKitJoinInfo;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

export type ConnectionStatus = "idle" | "connecting" | "ready" | "error" | "ended";

export interface AvatarState {
  emotion: string;
  pose: string;
  action: string;
  arousalLevel: number;
  clothingState: string;
  mediaUrl?: string;
}

export interface ServerWsEvent {
  type: string;
  [key: string]: unknown;
}

/* ── Token / Credits types ──────────────────────────────── */

export type SubscriptionTier = "free" | "gold" | "platinum";

export interface TokenBalance {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

export interface TokenCosts {
  liveMinute: number;
  tip: number;
  giftSmall: number;
  giftMedium: number;
  giftLarge: number;
  imageGeneration: number;
  videoGeneration: number;
  commandBasic: number;
  commandPremium: number;
}

export interface TierConfig {
  tier: SubscriptionTier;
  monthlyTokens: number;
  maxSessionMinutes: number;
  mediaGenerationsPerDay: number;
  customCharacters: boolean;
  liveCamAccess: boolean;
  multiCharacterScenes: boolean;
  priorityQueue: boolean;
}

/* ── Live Cam types ─────────────────────────────────────── */

export type RoomStatus = "offline" | "live" | "scheduled" | "ended";
export type GiftRarity = "common" | "rare" | "epic" | "legendary";
export type CommandTier = "free" | "basic" | "premium";

export interface LiveRoomListItem {
  id: string;
  characterId: string;
  pairedCharacterId?: string;
  status: RoomStatus;
  title: string;
  tags: string[];
  viewerCount: number;
  thumbnailUrl?: string;
}

export interface GiftDefinition {
  id: string;
  name: string;
  emoji: string;
  rarity: GiftRarity;
  cost: number;
  effectType: "float" | "burst" | "rain" | "fullscreen";
  animationDurationMs: number;
}

export interface GiftSendEvent {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  giftId: string;
  gift: GiftDefinition;
  createdAt: string;
}

export interface Tip {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  amount: number;
  message?: string;
  createdAt: string;
}

export interface TipLeaderboardEntry {
  userId: string;
  displayName: string;
  totalTipped: number;
  rank: number;
}

export interface CommandDefinition {
  id: string;
  label: string;
  description: string;
  tier: CommandTier;
  cost: number;
  cooldownSeconds: number;
}

export interface ScheduledShow {
  id: string;
  characterId: string;
  pairedCharacterId?: string;
  title: string;
  description: string;
  tags: string[];
  scheduledAt: string;
  durationMinutes: number;
  status: "upcoming" | "live" | "completed" | "cancelled";
  roomId?: string;
}