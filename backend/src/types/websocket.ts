import type { AvatarState } from "./session.js";

/** Client → server WebSocket events. */
export type ClientEventType = "user_message" | "ping" | "end_session";

export interface ClientEventBase {
  type: ClientEventType;
}

export interface UserMessageEvent extends ClientEventBase {
  type: "user_message";
  content: string;
}

export interface PingEvent extends ClientEventBase {
  type: "ping";
}

export interface EndSessionEvent extends ClientEventBase {
  type: "end_session";
}

export type ClientEvent = UserMessageEvent | PingEvent | EndSessionEvent;

/** Server → client WebSocket events. */
export type ServerEventType =
  | "session_ready"
  | "assistant_stream"
  | "assistant_complete"
  | "avatar_update"
  | "pong"
  | "session_ended"
  | "error";

export interface ServerEventBase {
  type: ServerEventType;
}

export interface SessionModeUiState {
  mode: "normal" | "edge_pace";
  label: string;
  phase: string;
  round: number;
  phaseRemainingSec: number;
  phaseElapsedSec?: number;
  phaseDurationSec?: number;
  coachCue: string;
  fireLine?: string;
  phaseChips?: string[];
  /** Studio Forge DNA tree soft stepper. */
  dnaTreeNodeId?: string;
  dnaTreeLabel?: string;
  dnaTreeAdvanced?: boolean;
}

export interface SessionReadyEvent extends ServerEventBase {
  type: "session_ready";
  sessionId: string;
  characterId: string;
  characterName: string;
  avatarState: AvatarState;
  /** Prior transcript when resuming or reconnecting. */
  messages?: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  sessionMode?: "normal" | "edge_pace";
  modeState?: SessionModeUiState;
}

export interface AssistantStreamEvent extends ServerEventBase {
  type: "assistant_stream";
  chunk: string;
  messageId: string;
}

export interface AssistantCompleteEvent extends ServerEventBase {
  type: "assistant_complete";
  messageId: string;
  content: string;
  avatarIntent: AvatarState;
  sessionNotes?: string;
  modeState?: SessionModeUiState;
}

export interface AvatarUpdateEvent extends ServerEventBase {
  type: "avatar_update";
  avatarState: AvatarState;
}

export interface PongEvent extends ServerEventBase {
  type: "pong";
}

export interface SessionEndedEvent extends ServerEventBase {
  type: "session_ended";
  reason: string;
}

export interface ErrorEvent extends ServerEventBase {
  type: "error";
  code: string;
  message: string;
}

export type ServerEvent =
  | SessionReadyEvent
  | AssistantStreamEvent
  | AssistantCompleteEvent
  | AvatarUpdateEvent
  | PongEvent
  | SessionEndedEvent
  | ErrorEvent;
