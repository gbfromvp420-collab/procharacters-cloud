import type { PromptSnapshot } from "../lib/live/types.js";
import type { SessionMemoryData } from "../lib/memory/types.js";

export type SessionStatus = "active" | "ended";

export interface AvatarState {
  emotion: string;
  pose: string;
  action: string;
  arousalLevel: number;
  clothingState: string;
  mediaUrl?: string;
}

export interface SessionRecord {
  id: string;
  characterId: string;
  promptVersion: string;
  promptSnapshot: PromptSnapshot;
  wsToken: string;
  status: SessionStatus;
  memory: SessionMemoryData;
  avatarState: AvatarState;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  /** Owning account (multi-device resume). */
  accountId?: string;
  /** Short public resume code — no raw ws token in share links. */
  resumeCode?: string;
}

export interface CreateSessionInput {
  characterId?: string;
  promptVersion?: string;
  accountId?: string;
}

export interface LiveKitJoinInfo {
  url: string;
  token: string;
  roomName: string;
}

export interface CreateSessionResult {
  sessionId: string;
  wsToken: string;
  characterId: string;
  promptVersion: string;
  wsUrl: string;
  livekit?: LiveKitJoinInfo;
  avatarState: AvatarState;
  resumeCode?: string;
  /** ISO expiry for resume code (sliding TTL extended on open/resume). */
  resumeExpiresAt?: string;
  accountId?: string;
}