/** Built-in defaults plus runtime custom character ids. */
export type CharacterId = string;

export type MediaClipKey = "idle" | "teasing" | "playful" | "aroused";

export type MediaOverrides = Partial<Record<MediaClipKey, string>>;

export interface LiveCharacterOption {
  id: string;
  displayName: string;
  defaultVersion: string;
  kind: "default" | "custom";
  avatarBase?: string;
  energyLabel?: string;
  teaser?: string;
  /** Signature first assistant line — for pre-start preview continuity. */
  openingMessage?: string;
  mediaBase?: string;
  mediaOverrides?: MediaOverrides;
  clips?: Record<MediaClipKey, string>;
  featured?: boolean;
  /** Account-owned My Character (private). */
  mine?: boolean;
  visibility?: string;
  baseModelId?: string;
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

export type SessionMode = "normal" | "edge_pace";

export interface SessionModeUiState {
  mode: SessionMode;
  label: string;
  phase: string;
  round: number;
  phaseRemainingSec: number;
  /** Seconds into the current phase (optional; older servers omit). */
  phaseElapsedSec?: number;
  /** Full length of current phase in seconds (optional). */
  phaseDurationSec?: number;
  coachCue: string;
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
  resumeCode?: string;
  /** ISO expiry after create/resume (sliding TTL extended on open). */
  resumeExpiresAt?: string;
  accountId?: string;
  sessionMode?: SessionMode;
  modeStartedAt?: string;
}

export interface CustomSceneInput {
  title: string;
  body: string;
}

export interface CreateCustomCharacterInput {
  name: string;
  appearance: string;
  energy?: string;
  clothing?: string;
  /** Any of the 8 signature models. */
  baseModelId?: string;
  avatarBase?: "twink-default" | "female-default";
  audience?: "gay" | "bi" | "straight" | "any";
  keyPhrases?: string[];
  scenes?: CustomSceneInput[];
  mediaBase?: string;
  mediaOverrides?: MediaOverrides;
}

export interface CreateCustomCharacterResponse {
  id: string;
  displayName: string;
  defaultVersion: string;
  kind: "custom";
  avatarBase: string;
  baseModelId?: string;
  energyLabel: string;
  signatureClothing: string;
  consistencyTraits: string[];
  createdAt: string;
  mediaBase?: string;
  mediaOverrides?: MediaOverrides;
  featured?: boolean;
  visibility?: string;
  mine?: boolean;
  keyPhrases?: string[];
  scenes?: CustomSceneInput[];
  clips?: Record<MediaClipKey, string>;
}

export interface UpdateCustomCharacterInput {
  mediaBase?: string | null;
  mediaOverrides?: MediaOverrides | null;
  name?: string;
  appearance?: string;
  energy?: string;
  clothing?: string;
  keyPhrases?: string[] | null;
  scenes?: CustomSceneInput[] | null;
  featured?: boolean;
}

export interface BaseModelPrefill {
  baseModelId: string;
  displayName: string;
  identityHint: string;
  vibeHint: string;
  clothingHint: string;
  avatarBase: "twink-default" | "female-default";
  energyLabel: string;
  teaser?: string;
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
  /** Phase 7: idle | tease | play | edge (optional, from server). */
  energyBand?: string;
  pose: string;
  action: string;
  arousalLevel: number;
  clothingState: string;
  mediaUrl?: string;
  /** Interim pack if dedicated /avatar/<id>/ clip 404s */
  mediaFallbackUrl?: string;
  /** Presence grade for client atmosphere (twink_gym, female_goth, …) */
  presenceSkin?: string;
  /** Epoch ms — prefer fresher LiveKit/WS updates */
  updatedAt?: number;
}

export interface ServerWsEvent {
  type: string;
  [key: string]: unknown;
}
