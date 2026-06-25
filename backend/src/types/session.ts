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
}

export interface CreateSessionInput {
  characterId?: string;
  promptVersion?: string;
}

export interface CreateSessionResult {
  sessionId: string;
  wsToken: string;
  characterId: string;
  promptVersion: string;
  wsUrl: string;
}