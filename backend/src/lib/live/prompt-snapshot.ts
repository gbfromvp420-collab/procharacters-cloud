import { createHash } from "node:crypto";
import { loadCharacterBundle } from "../characters/loader.js";
import { loadSystemCorePrompt } from "../prompts/loader.js";
import { assertLiveCharacter } from "./character-catalog.js";
import type { PromptSnapshot } from "./types.js";

export async function createPromptSnapshot(
  characterId: string,
  promptVersion?: string,
): Promise<PromptSnapshot> {
  const profile = assertLiveCharacter(characterId);
  const version = promptVersion ?? profile.defaultVersion;

  const [bundle, systemCorePrompt] = await Promise.all([
    loadCharacterBundle(characterId, version),
    loadSystemCorePrompt(),
  ]);

  const hashInput = [
    bundle.id,
    bundle.promptVersion,
    bundle.promptPath,
    bundle.promptBody,
    systemCorePrompt,
    bundle.appearanceAnchor,
    profile.consistencyTraits.join("|"),
  ].join("\n");

  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

  return {
    characterId: bundle.id,
    characterName: bundle.name,
    promptVersion: bundle.promptVersion,
    promptPath: bundle.promptPath,
    systemCorePath: "prompts/library/naughty-syntax/system-core/v1.0.0/prompt.md",
    characterPrompt: bundle.promptBody,
    systemCorePrompt,
    appearanceAnchor: bundle.appearanceAnchor,
    consistencyTraits: profile.consistencyTraits,
    signatureClothing: profile.signatureClothing,
    hash,
    createdAt: new Date().toISOString(),
  };
}