import { readFile } from "node:fs/promises";
import { repoPath } from "../paths.js";
import type { CharacterRegistry, RegistryEntry } from "./types.js";

const REGISTRY_PATH = "characters/registry.json";

let cachedRegistry: CharacterRegistry | null = null;

export async function loadCharacterRegistry(): Promise<CharacterRegistry> {
  if (cachedRegistry) {
    return cachedRegistry;
  }

  const raw = await readFile(repoPath(REGISTRY_PATH), "utf-8");
  cachedRegistry = JSON.parse(raw) as CharacterRegistry;
  return cachedRegistry;
}

export async function getRegistryEntry(characterId: string): Promise<RegistryEntry | null> {
  const registry = await loadCharacterRegistry();
  return registry.entries.find((entry) => entry.id === characterId) ?? null;
}

export async function listActiveCharacters(): Promise<RegistryEntry[]> {
  const registry = await loadCharacterRegistry();
  return registry.entries.filter((entry) => entry.status === "active");
}

export function clearRegistryCache(): void {
  cachedRegistry = null;
}