/** Built-in defaults plus runtime custom character ids. */
export type CharacterId = string;

export interface LiveCharacterOption {
  id: string;
  displayName: string;
  defaultVersion: string;
  kind: "default" | "custom";
  avatarBase?: string;
  energyLabel?: string;
}

export interface LiveKitJoinInfo {
  url: string;
  token: string;
  roomName: string;
}

export interface MemoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  wsToken: string;
  characterId: string;
  promptVersion: string;
  wsUrl: string;
  avatarState: AvatarState;
  messages?: MemoryMessage[];
  livekit?: LiveKitJoinInfo;
}

export interface CreateCustomCharacterInput {
  name: string;
  appearance: string;
  energy?: string;
  clothing?: string;
  avatarBase?: "twink-default" | "female-default";
  audience?: "gay" | "bi" | "straight" | "any";
}

export interface CreateCustomCharacterResponse {
  id: string;
  displayName: string;
  defaultVersion: string;
  kind: "custom";
  avatarBase: string;
  energyLabel: string;
  signatureClothing: string;
  consistencyTraits: string[];
  createdAt: string;
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
