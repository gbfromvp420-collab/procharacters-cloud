import { createHash } from "node:crypto";
import { loadCharacterBundle } from "../characters/loader.js";
import { loadSystemCorePrompt } from "../prompts/loader.js";
import { applyAgeFloor } from "./age-floor.js";
import { assertLiveCharacter } from "./character-catalog.js";
import { getCustomCharacter } from "./custom-characters.js";
import type { PromptSnapshot } from "./types.js";

export async function createPromptSnapshot(
  characterId: string,
  promptVersion?: string,
  options?: { accountId?: string | null },
): Promise<PromptSnapshot> {
  const systemCorePrompt = await loadSystemCorePrompt();

  const custom = getCustomCharacter(characterId);
  if (custom) {
    if (
      custom.ownerAccountId &&
      options?.accountId &&
      custom.ownerAccountId !== options.accountId
    ) {
      throw new Error(`Character '${characterId}' is private`);
    }
    const characterPrompt = applyAgeFloor(custom.characterPrompt);
    const appearanceAnchor = applyAgeFloor(custom.appearanceAnchor);
    const core = applyAgeFloor(systemCorePrompt);
    const hashInput = [
      custom.id,
      custom.defaultVersion,
      characterPrompt,
      core,
      appearanceAnchor,
      custom.consistencyTraits.join("|"),
    ].join("\n");
    const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

    return {
      characterId: custom.id,
      characterName: custom.displayName,
      promptVersion: custom.defaultVersion,
      promptPath: `runtime/custom/${custom.id}`,
      systemCorePath: "prompts/library/naughty-syntax/system-core/v1.0.0/prompt.md",
      characterPrompt,
      systemCorePrompt: core,
      appearanceAnchor,
      consistencyTraits: custom.consistencyTraits,
      signatureClothing: custom.signatureClothing,
      hash,
      createdAt: new Date().toISOString(),
    };
  }

  const profile = assertLiveCharacter(characterId, options);
  const version = promptVersion ?? profile.defaultVersion;
  const bundle = await loadCharacterBundle(characterId, version);

  const characterPrompt = applyAgeFloor(bundle.promptBody);
  const appearanceAnchor = applyAgeFloor(bundle.appearanceAnchor);
  const core = applyAgeFloor(systemCorePrompt);
  const hashInput = [
    bundle.id,
    bundle.promptVersion,
    bundle.promptPath,
    characterPrompt,
    core,
    appearanceAnchor,
    profile.consistencyTraits.join("|"),
  ].join("\n");

  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

  return {
    characterId: bundle.id,
    characterName: bundle.name,
    promptVersion: bundle.promptVersion,
    promptPath: bundle.promptPath,
    systemCorePath: "prompts/library/naughty-syntax/system-core/v1.0.0/prompt.md",
    characterPrompt,
    systemCorePrompt: core,
    appearanceAnchor,
    consistencyTraits: profile.consistencyTraits,
    signatureClothing: profile.signatureClothing,
    hash,
    createdAt: new Date().toISOString(),
  };
}
