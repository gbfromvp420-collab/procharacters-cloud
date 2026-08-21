/**
 * @deprecated Use LivePromptInjector from lib/live instead.
 */
import type { AssembledPrompt } from "../../types/character.js";
import { LivePromptInjector, createPromptSnapshot } from "../live/index.js";
import { SessionMemory } from "../memory/session-memory.js";

export interface AssemblePromptInput {
  characterId: string;
  promptVersion?: string;
}

const injector = new LivePromptInjector();

export async function assembleSessionPrompt(input: AssemblePromptInput): Promise<AssembledPrompt> {
  const snapshot = await createPromptSnapshot(input.characterId, input.promptVersion);
  const memory = SessionMemory.empty();
  const result = injector.injectTurn(snapshot, { context: memory.getRecentContext() });

  return {
    characterId: result.characterId,
    promptVersion: result.promptVersion,
    systemPrompt: result.systemPrompt,
    messageCount: 0,
    hash: result.hash,
  };
}
