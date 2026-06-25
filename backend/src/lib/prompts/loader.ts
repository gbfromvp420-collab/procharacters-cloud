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
  const absolute = repoPath(manifestPath);
  if (existsSync(absolute)) {
    return manifestPath;
  }

  const normalized = normalizeVersion(version);
  const folderFallback = `prompts/library/naughty-syntax/${characterId}/${normalized}/prompt.md`;
  if (existsSync(repoPath(folderFallback))) {
    return folderFallback;
  }

  const flatFallback = `prompts/library/naughty-syntax/${characterId}/${normalized}.md`;
  if (existsSync(repoPath(flatFallback))) {
    return flatFallback;
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