import type { RecentContext } from "../memory/types.js";

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

/** Pinned at session start — immune to manifest/file changes mid-session. */
export interface PromptSnapshot {
  characterId: string;
  characterName: string;
  promptVersion: string;
  promptPath: string;
  systemCorePath: string;
  characterPrompt: string;
  systemCorePrompt: string;
  appearanceAnchor: string;
  consistencyTraits: string[];
  signatureClothing: string;
  hash: string;
  createdAt: string;
}

/** Memory passed into LivePromptInjector each turn. */
export interface SessionMemoryInput {
  context: RecentContext;
  pendingUserMessage?: string;
}

export interface PromptLayers {
  platform: string;
  character: string;
  consistency: string;
  memory: string;
  liveFormat: string;
}

export interface LiveInjectionResult {
  characterId: string;
  promptVersion: string;
  hash: string;
  systemPrompt: string;
  messages: LlmMessage[];
  layers: PromptLayers;
  consistencyTraits: string[];
  turnNumber: number;
}