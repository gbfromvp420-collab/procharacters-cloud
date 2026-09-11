import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { repoPath } from "../paths.js";
import { DEFAULT_PROMPT_VERSION, SYSTEM_CORE_PROMPT_PATH } from "../../config/constants.js";
import { getManifestCharacter, getSystemPromptMeta } from "./manifest.js";

export class PromptNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptNotFoundError";
  }
}

function normalizeVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function resolvePromptPath(
  manifestPath: string,
  characterId: string,
  version: string,
): string {
  // The requested version wins over the manifest path. Characters can carry
  // several versions on disk, and a session that pinned an older one must keep
  // getting that one instead of whatever the manifest currently points at.
  const normalized = normalizeVersion(version);
  const versioned = `prompts/library/naughty-syntax/${characterId}/${normalized}/prompt.md`;
  if (existsSync(repoPath(versioned))) {
    return versioned;
  }

  const flat = `prompts/library/naughty-syntax/${characterId}/${normalized}.md`;
  if (existsSync(repoPath(flat))) {
    return flat;
  }

  return manifestPath;
}

export async function loadPromptBody(
  characterId: string,
  version = DEFAULT_PROMPT_VERSION,
): Promise<{ body: string; path: string; version: string }> {
  const entry = await getManifestCharacter(characterId);
  if (!entry) {
    throw new PromptNotFoundError(`No manifest entry for character '${characterId}'`);
  }

  const resolvedVersion = normalizeVersion(version || entry.current_version);
  const resolvedPath = resolvePromptPath(entry.path, characterId, resolvedVersion);
  const absolutePath = repoPath(resolvedPath);

  if (!existsSync(absolutePath)) {
    throw new PromptNotFoundError(
      `Prompt file not found for '${characterId}' @ ${resolvedVersion}: ${resolvedPath}`,
    );
  }

  const body = await readFile(absolutePath, "utf-8");
  return { body, path: resolvedPath, version: resolvedVersion };
}

export async function loadSystemCorePrompt(): Promise<string> {
  const meta = await getSystemPromptMeta();
  const manifestPath = meta?.path ?? SYSTEM_CORE_PROMPT_PATH;
  const absolutePath = repoPath(manifestPath);

  if (!existsSync(absolutePath)) {
    const fallbackPath = repoPath(SYSTEM_CORE_PROMPT_PATH);
    if (!existsSync(fallbackPath)) {
      throw new PromptNotFoundError(`System core prompt missing at ${manifestPath}`);
    }
    return readFile(fallbackPath, "utf-8");
  }

  return readFile(absolutePath, "utf-8");
}