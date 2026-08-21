import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { repoPath } from "../paths.js";
import { DEFAULT_PROMPT_VERSION } from "../../config/constants.js";
import type { CharacterBundle, CharacterModelJson } from "../../types/character.js";
import { getManifestCharacter } from "../prompts/manifest.js";
import { loadPromptBody } from "../prompts/loader.js";
import { getRegistryEntry } from "./registry.js";

export class CharacterNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterNotFoundError";
  }
}

function buildAppearanceAnchor(model: CharacterModelJson): string {
  const appearance = Object.entries(model.appearance)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  const energy = model.personality.energy.join(", ");

  return [
    `Character: ${model.name}`,
    `Description: ${model.description}`,
    "Appearance anchor:",
    appearance,
    `Energy: ${energy}`,
    `Tone: ${model.personality.tone}`,
  ].join("\n");
}

export async function loadCharacterBundle(
  characterId: string,
  promptVersion = DEFAULT_PROMPT_VERSION,
): Promise<CharacterBundle> {
  const registryEntry = await getRegistryEntry(characterId);
  if (!registryEntry || registryEntry.status !== "active") {
    throw new CharacterNotFoundError(`Character '${characterId}' is not active or missing`);
  }

  const manifestEntry = await getManifestCharacter(characterId);
  if (!manifestEntry) {
    throw new CharacterNotFoundError(`Character '${characterId}' missing from prompt manifest`);
  }

  const modelPath = repoPath("characters", registryEntry.path);
  if (!existsSync(modelPath)) {
    throw new CharacterNotFoundError(
      `Model file missing for '${characterId}': ${registryEntry.path}`,
    );
  }

  const model = JSON.parse(await readFile(modelPath, "utf-8")) as CharacterModelJson;
  const prompt = await loadPromptBody(characterId, promptVersion);

  return {
    id: characterId,
    name: manifestEntry.name,
    brand: manifestEntry.brand,
    promptVersion: prompt.version,
    promptPath: prompt.path,
    promptBody: prompt.body,
    model,
    appearanceAnchor: buildAppearanceAnchor(model),
  };
}
