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