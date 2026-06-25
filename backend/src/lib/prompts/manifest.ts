import { readFile } from "node:fs/promises";
import { repoPath } from "../paths.js";
import type { ManifestCharacterEntry, PromptManifest } from "./types.js";

const MANIFEST_PATH = "prompts/manifest.json";

let cachedManifest: PromptManifest | null = null;

export async function loadPromptManifest(): Promise<PromptManifest> {
  if (cachedManifest) {
    return cachedManifest;
  }

  const raw = await readFile(repoPath(MANIFEST_PATH), "utf-8");
  cachedManifest = JSON.parse(raw) as PromptManifest;
  return cachedManifest;
}

export async function listManifestCharacters(): Promise<ManifestCharacterEntry[]> {
  const manifest = await loadPromptManifest();
  return Object.values(manifest.characters);
}

export async function getManifestCharacter(
  characterId: string,
): Promise<ManifestCharacterEntry | null> {
  const manifest = await loadPromptManifest();
  return manifest.characters[characterId] ?? null;
}

export async function getSystemPromptMeta(): Promise<PromptManifest["system"]> {
  const manifest = await loadPromptManifest();
  return manifest.system;
}

export function clearManifestCache(): void {
  cachedManifest = null;
}