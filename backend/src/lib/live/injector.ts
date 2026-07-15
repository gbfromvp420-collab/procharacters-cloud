import { createHash } from "node:crypto";
import { formatMemoryBlock, toLlmMessages } from "../memory/prompt-formatter.js";
import { getLiveCharacterProfile } from "./character-catalog.js";
import { buildPresenceAvatarHint } from "./presence-profiles.js";
import { buildConsistencyBlock, buildLiveFormatInstructions } from "./system-instructions.js";
import type { LiveInjectionResult, PromptSnapshot, SessionMemoryInput } from "./types.js";

/**
 * Assembles the full LLM context for one live chat turn.
 *
 * System prompt layers: platform → character → consistency → session memory → live format
 * Conversation: recent user/assistant messages from SessionMemory
 */
export class LivePromptInjector {
  injectTurn(snapshot: PromptSnapshot, memory: SessionMemoryInput): LiveInjectionResult {
    const profile = getLiveCharacterProfile(snapshot.characterId);
    const energyLabel = profile?.energyLabel ?? "teasing, foreplay-first";
    const presenceHint = buildPresenceAvatarHint(snapshot.characterId);
    const formatOptions = { pendingUserMessage: memory.pendingUserMessage };

    const platform = snapshot.systemCorePrompt;
    const character = snapshot.characterPrompt;
    const consistency = buildConsistencyBlock(
      snapshot.consistencyTraits,
      snapshot.appearanceAnchor,
    );
    const memoryBlock = formatMemoryBlock(memory.context, formatOptions);
    const liveFormat = buildLiveFormatInstructions(energyLabel, presenceHint);
    const sessionMode = memory.sessionModeBlock?.trim() || "";

    const systemPrompt = [
      platform,
      "---",
      character,
      "---",
      consistency,
      "---",
      memoryBlock,
      ...(sessionMode ? ["---", sessionMode] : []),
      "---",
      liveFormat,
    ].join("\n\n");

    const conversation = toLlmMessages(memory.context, formatOptions);
    const messages = [{ role: "system" as const, content: systemPrompt }, ...conversation];
    const hash = createHash("sha256").update(systemPrompt).digest("hex").slice(0, 16);
    const turnNumber =
      Math.floor(memory.context.messageCount / 2) + (memory.pendingUserMessage ? 1 : 0);

    return {
      characterId: snapshot.characterId,
      promptVersion: snapshot.promptVersion,
      hash,
      systemPrompt,
      messages,
      layers: {
        platform,
        character,
        consistency,
        memory: memoryBlock,
        liveFormat,
        ...(sessionMode ? { sessionMode } : {}),
      },
      consistencyTraits: snapshot.consistencyTraits,
      turnNumber,
    };
  }
}