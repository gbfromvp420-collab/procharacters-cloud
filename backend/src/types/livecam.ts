/**
 * Live cam model types — Feature B.
 *
 * Covers room state, viewer tracking, tipping, gifts,
 * commands, scheduled shows, and multi-character pairing.
 */

import type { AvatarState } from "./session.js";

/* ── Room state ─────────────────────────────────────────── */

export type RoomStatus = "offline" | "live" | "scheduled" | "ended";

export interface LiveRoom {
  id: string;
  characterId: string;
  /** Optional second character for paired scenes. */
  pairedCharacterId?: string;
  status: RoomStatus;
  title: string;
  tags: string[];
  viewerCount: number;
  peakViewerCount: number;
  avatarState: AvatarState;
  pairedAvatarState?: AvatarState;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

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

/* ── Tipping ────────────────────────────────────────────── */

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

/* ── Gifts ──────────────────────────────────────────────── */

export type GiftRarity = "common" | "rare" | "epic" | "legendary";

export interface GiftDefinition {
  id: string;
  name: string;
  emoji: string;
  rarity: GiftRarity;
  cost: number;
  /** Visual effect triggered on screen when gift is sent. */
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

/* ── Commands ("make them do something") ────────────────── */

export type CommandTier = "free" | "basic" | "premium";

export interface CommandDefinition {
  id: string;
  label: string;
  description: string;
  tier: CommandTier;
  cost: number;
  cooldownSeconds: number;
  /** Prompt fragment injected into the LLM context. */
  promptFragment: string;
  /** Avatar state override triggered by the command. */
  avatarOverride?: Partial<AvatarState>;
}

export interface CommandRequest {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  commandId: string;
  command: CommandDefinition;
  status: "pending" | "executing" | "completed" | "rejected";
  createdAt: string;
}

/* ── Scheduled shows ────────────────────────────────────── */

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
  createdAt: string;
}

/* ── WebSocket extensions for live cam ──────────────────── */

export type LiveCamClientEventType =
  | "send_tip"
  | "send_gift"
  | "send_command"
  | "join_room"
  | "leave_room";

export type LiveCamServerEventType =
  | "room_state"
  | "tip_received"
  | "gift_received"
  | "command_executed"
  | "viewer_count"
  | "show_starting"
  | "show_ending"
  | "paired_avatar_update";
