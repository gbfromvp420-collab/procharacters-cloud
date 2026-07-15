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
  /** Phase 7 energy band for UI: idle | tease | play | edge */
  energyBand?: string;
}

export type SessionMode = "normal" | "edge_pace";

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
  /** Phase 10: normal | edge_pace */
  sessionMode?: SessionMode;
  /** ISO when mode clock started. */
  modeStartedAt?: string;
}

export interface CreateSessionInput {
  characterId?: string;
  promptVersion?: string;
  accountId?: string;
  /** Override message window for this session (clamped). */
  messageWindow?: number;
  /** Signed-in only: seed prior notes if user opted in for this character. */
  useCrossSessionMemory?: boolean;
  /** Phase 10 assistant mode preview. */
  sessionMode?: SessionMode;
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
  sessionMode?: SessionMode;
  modeStartedAt?: string;
}