import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { repoPath } from "../paths.js";
import type { LiveCharacterProfile } from "./character-catalog.js";

export type CustomAvatarBase = "twink-default" | "female-default";

/** Four shipped loop slots — map Grok emotions onto these. */
export type MediaClipKey = "idle" | "teasing" | "playful" | "aroused";

export type MediaOverrides = Partial<Record<MediaClipKey, string>>;

export interface CustomCharacterInput {
  name: string;
  /** Short appearance description the model must stay locked to. */
  appearance: string;
  /** Energy / personality (edging, teasing, dominant, etc.). */
  energy?: string;
  /** Clothing focus for erotic consistency. */
  clothing?: string;
  /** Which default clip set + body archetype to borrow. */
  avatarBase?: CustomAvatarBase;
  /** Audience tag for prompt framing. */
  audience?: "gay" | "bi" | "straight" | "any";
  /**
   * Optional folder of loops, e.g. `/avatar/packs/diego`
   * Expects idle.mp4, teasing.mp4, playful.mp4, aroused.mp4 inside.
   */
  mediaBase?: string;
  /** Optional per-emotion absolute/relative media URLs (override mediaBase). */
  mediaOverrides?: MediaOverrides;
}

export interface CustomCharacterRecord extends LiveCharacterProfile {
  kind: "custom";
  avatarBase: CustomAvatarBase;
  appearance: string;
  energy: string;
  clothing: string;
  audience: string;
  characterPrompt: string;
  appearanceAnchor: string;
  createdAt: string;
  mediaBase?: string;
  mediaOverrides?: MediaOverrides;
}

interface CustomCharacterFile {
  version: 1;
  updatedAt: string;
  characters: CustomCharacterRecord[];
}

const store = new Map<string, CustomCharacterRecord>();
let loaded = false;
let persistPath: string | null = null;

function resolvePersistPath(): string {
  if (process.env.CUSTOM_CHARACTERS_PATH?.trim()) {
    return process.env.CUSTOM_CHARACTERS_PATH.trim();
  }
  return repoPath("data", "custom-characters.json");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function buildPrompt(input: Required<
  Pick<CustomCharacterInput, "name" | "appearance" | "energy" | "clothing" | "audience">
>): string {
  return [
    `# Naughty Syntax — Custom Character: ${input.name}`,
    ``,
    `## Core Identity`,
    `${input.name} is a consenting adult (18+) custom character for live NSFW chat.`,
    `Stay fully in character. Photorealistic erotic style. Uncensored.`,
    ``,
    `## Visual Style & Appearance`,
    input.appearance,
    `- Signature clothing focus: ${input.clothing}`,
    `- Keep appearance consistent every reply — never drift body type, hair, skin, or outfit`,
    ``,
    `## Energy & Personality`,
    input.energy,
    `- Slow, seductive pacing; build tension; invite the user`,
    `- React to user messages with visible arousal and clothing detail`,
    ``,
    `## Audience`,
    `Primary audience framing: ${input.audience}`,
    ``,
    `## Explicit Content Rules`,
    `- Fully uncensored explicit NSFW`,
    `- Detailed anatomy, arousal, fabric transparency, and physical reactions`,
    `- Stay premium, seductive, and consistent with the appearance anchor`,
    ``,
    `## Usage`,
    `Live chat replies only. Keep responses vivid, in-character, and on-brand for Naughty Syntax.`,
  ].join("\n");
}

function buildTraits(input: {
  appearance: string;
  clothing: string;
  energy: string;
}): string[] {
  const appearanceBits = input.appearance
    .split(/[.,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 4);

  return [
    ...appearanceBits,
    input.clothing,
    input.energy.slice(0, 80),
    "photorealistic erotic detail",
    "consistent appearance every turn",
  ].filter(Boolean);
}

const CLIP_KEYS: MediaClipKey[] = ["idle", "teasing", "playful", "aroused"];

function sanitizeMediaBase(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  let value = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(value) && !value.startsWith("/")) {
    value = `/${value}`;
  }
  if (value.length > 300) {
    throw new Error("mediaBase is too long");
  }
  return value;
}

function sanitizeMediaOverrides(raw?: MediaOverrides): MediaOverrides | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: MediaOverrides = {};
  for (const key of CLIP_KEYS) {
    const value = raw[key]?.trim();
    if (!value) continue;
    if (value.length > 500) {
      throw new Error(`mediaOverrides.${key} is too long`);
    }
    out[key] = /^https?:\/\//i.test(value) || value.startsWith("/") ? value : `/${value}`;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function isRecord(value: unknown): value is CustomCharacterRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as CustomCharacterRecord;
  return (
    r.kind === "custom" &&
    typeof r.id === "string" &&
    typeof r.displayName === "string" &&
    typeof r.characterPrompt === "string" &&
    typeof r.appearance === "string"
  );
}

async function persist(): Promise<void> {
  if (!persistPath) return;

  const payload: CustomCharacterFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    characters: listCustomCharacters(),
  };

  await mkdir(dirname(persistPath), { recursive: true });
  await writeFile(persistPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/**
 * Load custom characters from disk. Safe to call multiple times.
 * Missing file = empty store (not an error).
 */
export async function initCustomCharacters(path?: string): Promise<{
  path: string;
  count: number;
}> {
  const resolved = path?.trim() || resolvePersistPath();
  persistPath = resolved;
  store.clear();

  try {
    const raw = await readFile(resolved, "utf8");
    const parsed = JSON.parse(raw) as CustomCharacterFile | CustomCharacterRecord[];
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.characters)
        ? parsed.characters
        : [];

    for (const entry of list) {
      if (isRecord(entry)) {
        store.set(entry.id, entry);
      }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.error(`[custom-characters] failed to load ${resolved}:`, error);
    }
  }

  loaded = true;
  return { path: resolved, count: store.size };
}

export function listCustomCharacters(): CustomCharacterRecord[] {
  return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCustomCharacter(id: string): CustomCharacterRecord | null {
  return store.get(id) ?? null;
}

export async function createCustomCharacter(
  raw: CustomCharacterInput,
): Promise<CustomCharacterRecord> {
  if (!loaded) {
    await initCustomCharacters();
  }

  const name = raw.name?.trim();
  const appearance = raw.appearance?.trim();
  if (!name || name.length < 2) {
    throw new Error("Custom character name is required (min 2 chars)");
  }
  if (!appearance || appearance.length < 12) {
    throw new Error("Appearance description is required (min 12 chars)");
  }

  const energy =
    raw.energy?.trim() ||
    "Slow seductive teasing, playful confidence, and building sexual tension.";
  const clothing =
    raw.clothing?.trim() ||
    (raw.avatarBase === "female-default"
      ? "crotchless undies, visible arousal"
      : "sheer thong / g-string, visible arousal");
  const avatarBase: CustomAvatarBase =
    raw.avatarBase === "female-default" ? "female-default" : "twink-default";
  const audience = raw.audience ?? (avatarBase === "female-default" ? "straight" : "gay");

  const slug = slugify(name) || "custom";
  const id = `custom-${slug}-${randomUUID().slice(0, 8)}`;

  const characterPrompt = buildPrompt({ name, appearance, energy, clothing, audience });
  const appearanceAnchor = [
    `Character: ${name}`,
    `Description: ${appearance}`,
    `Clothing: ${clothing}`,
    `Energy: ${energy}`,
    `Audience: ${audience}`,
  ].join("\n");

  const mediaBase = sanitizeMediaBase(raw.mediaBase);
  const mediaOverrides = sanitizeMediaOverrides(raw.mediaOverrides);

  const record: CustomCharacterRecord = {
    kind: "custom",
    id,
    displayName: name,
    defaultVersion: "custom-v1",
    consistencyTraits: buildTraits({ appearance, clothing, energy }),
    signatureClothing:
      clothing.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48) || "custom_outfit",
    energyLabel: energy.slice(0, 80),
    avatarBase,
    appearance,
    energy,
    clothing,
    audience,
    characterPrompt,
    appearanceAnchor,
    createdAt: new Date().toISOString(),
    ...(mediaBase ? { mediaBase } : {}),
    ...(mediaOverrides ? { mediaOverrides } : {}),
  };

  store.set(id, record);
  await persist();
  return record;
}

export interface UpdateCustomCharacterInput {
  mediaBase?: string | null;
  mediaOverrides?: MediaOverrides | null;
  energy?: string;
  clothing?: string;
}

export async function updateCustomCharacter(
  id: string,
  patch: UpdateCustomCharacterInput,
): Promise<CustomCharacterRecord> {
  if (!loaded) {
    await initCustomCharacters();
  }
  const existing = store.get(id);
  if (!existing) {
    throw new Error(`Custom character not found: ${id}`);
  }

  const next: CustomCharacterRecord = { ...existing };

  if (patch.mediaBase !== undefined) {
    if (patch.mediaBase === null || patch.mediaBase.trim() === "") {
      delete next.mediaBase;
    } else {
      next.mediaBase = sanitizeMediaBase(patch.mediaBase);
    }
  }

  if (patch.mediaOverrides !== undefined) {
    if (patch.mediaOverrides === null) {
      delete next.mediaOverrides;
    } else {
      next.mediaOverrides = sanitizeMediaOverrides(patch.mediaOverrides);
      if (!next.mediaOverrides) delete next.mediaOverrides;
    }
  }

  if (patch.energy?.trim()) {
    next.energy = patch.energy.trim();
    next.energyLabel = next.energy.slice(0, 80);
  }
  if (patch.clothing?.trim()) {
    next.clothing = patch.clothing.trim();
    next.signatureClothing =
      next.clothing.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48) || "custom_outfit";
  }

  store.set(id, next);
  await persist();
  return next;
}

export async function deleteCustomCharacter(id: string): Promise<boolean> {
  if (!loaded) {
    await initCustomCharacters();
  }
  if (!store.has(id)) return false;
  store.delete(id);
  await persist();
  return true;
}

export function getCustomCharactersPersistPath(): string | null {
  return persistPath;
}
