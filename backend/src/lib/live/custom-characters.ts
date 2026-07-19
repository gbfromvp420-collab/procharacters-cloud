import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  accountHasActivePremium,
  getAccount,
} from "../accounts/account-store.js";
import { repoPath } from "../paths.js";
import {
  LIVE_CHARACTER_CATALOG,
  type LiveCharacterProfile,
} from "./character-catalog.js";

/** Clip pack roots (engine media). Phase 4 models resolve here via avatarBase. */
export type CustomAvatarBase = "twink-default" | "female-default";

/** Four shipped loop slots — map Grok emotions onto these. */
export type MediaClipKey = "idle" | "teasing" | "playful" | "aroused";

export type MediaOverrides = Partial<Record<MediaClipKey, string>>;

export type CustomVisibility = "private" | "unlisted" | "featured";

export interface CustomScene {
  title: string;
  body: string;
}

export interface CustomCharacterInput {
  name: string;
  /** Core identity / appearance lock. */
  appearance: string;
  /** Energy / vibe. */
  energy?: string;
  clothing?: string;
  /**
   * Signature base model (any of 8). Preferred over avatarBase alone.
   * Defaults from avatarBase if omitted.
   */
  baseModelId?: string;
  /** Clip pack root — resolved from baseModelId when omitted. */
  avatarBase?: CustomAvatarBase;
  audience?: "gay" | "bi" | "straight" | "any";
  /** Short dirty-talk / tease lines (max 4 slim studio). */
  keyPhrases?: string[];
  /** Optional scene anchors (0–2 slim studio). */
  scenes?: CustomScene[];
  mediaBase?: string;
  mediaOverrides?: MediaOverrides;
  /** @deprecated v2 private-only — ignored for new account customs */
  featured?: boolean;
  /** Required for My Character (private). */
  ownerAccountId?: string;
  visibility?: CustomVisibility;
}

export interface CustomCharacterRecord extends LiveCharacterProfile {
  kind: "custom";
  avatarBase: CustomAvatarBase;
  /** Signature model this custom is built on. */
  baseModelId: string;
  appearance: string;
  energy: string;
  clothing: string;
  audience: string;
  keyPhrases?: string[];
  scenes?: CustomScene[];
  characterPrompt: string;
  appearanceAnchor: string;
  createdAt: string;
  updatedAt?: string;
  mediaBase?: string;
  mediaOverrides?: MediaOverrides;
  featured?: boolean;
  ownerAccountId?: string;
  visibility?: CustomVisibility;
}

interface CustomCharacterFile {
  version: 1 | 2;
  updatedAt: string;
  characters: CustomCharacterRecord[];
}

const store = new Map<string, CustomCharacterRecord>();
let loaded = false;
let persistPath: string | null = null;

const CUSTOMS_PER_ACCOUNT_FREE = Number(process.env.CUSTOM_CHARS_PER_ACCOUNT ?? 10);
const CUSTOMS_PER_ACCOUNT_PREMIUM = Number(
  process.env.CUSTOM_CHARS_PER_ACCOUNT_PREMIUM ?? 40,
);
/** Slim Studio v2 — quality over field sprawl. */
const MAX_SCENES = 2;
const MAX_PHRASES = 4;

function customsLimitForAccount(accountId?: string): number {
  if (!accountId) return CUSTOMS_PER_ACCOUNT_FREE;
  const acc = getAccount(accountId);
  if (acc && accountHasActivePremium(acc)) return CUSTOMS_PER_ACCOUNT_PREMIUM;
  return CUSTOMS_PER_ACCOUNT_FREE;
}

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

export function isSignatureModelId(id: string): boolean {
  return id in LIVE_CHARACTER_CATALOG;
}

export function resolveAvatarBaseFromModel(baseModelId: string): CustomAvatarBase {
  const profile = LIVE_CHARACTER_CATALOG[baseModelId];
  const ab = profile?.avatarBase ?? baseModelId;
  return ab === "female-default" ? "female-default" : "twink-default";
}

function defaultClothing(avatarBase: CustomAvatarBase): string {
  return avatarBase === "female-default"
    ? "crotchless undies / open panel framing, visible arousal"
    : "sheer thong / g-string, visible arousal";
}

function sanitizeScenes(raw?: CustomScene[]): CustomScene[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  const out: CustomScene[] = [];
  for (const s of raw.slice(0, MAX_SCENES)) {
    const title = String(s?.title ?? "").trim().slice(0, 80);
    const body = String(s?.body ?? "").trim().slice(0, 600);
    if (title.length < 2 || body.length < 12) continue;
    out.push({ title, body });
  }
  return out.length ? out : undefined;
}

function sanitizePhrases(raw?: string[]): string[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  const out = raw
    .map((p) => String(p ?? "").trim().slice(0, 120))
    .filter((p) => p.length >= 2)
    .slice(0, MAX_PHRASES);
  return out.length ? out : undefined;
}

/**
 * Slim Studio prompt — user identity owns the mind.
 * Base model id is video/clip root only; we do NOT paste full signature base
 * prompts (that typecast customs into catalog look/energy).
 */
async function buildPromptV2(input: {
  name: string;
  appearance: string;
  energy: string;
  clothing: string;
  audience: string;
  baseModelId: string;
  keyPhrases?: string[];
  scenes?: CustomScene[];
}): Promise<string> {
  const phraseBlock =
    input.keyPhrases && input.keyPhrases.length
      ? [
          ``,
          `## Key phrases (use naturally, sparingly — never every line)`,
          ...input.keyPhrases.map((p) => `- “${p}”`),
        ]
      : [];

  const sceneBlock =
    input.scenes && input.scenes.length
      ? [
          ``,
          `## Scene anchors (optional pace cues — follow user if they lead)`,
          ...input.scenes.map(
            (s, i) => `${i + 1}. **${s.title}** — ${s.body}`,
          ),
        ]
      : [];

  const clothingLine = input.clothing?.trim()
    ? `- Clothing note: ${input.clothing.trim()}`
    : null;

  const audienceLine =
    input.audience && input.audience !== "any"
      ? [`## Audience`, `Primary framing: ${input.audience}`, ``]
      : [];

  const energy =
    input.energy?.trim() ||
    "Match the user's pace; tease and escalate on invitation.";

  return [
    `# Naughty Syntax — My Character: ${input.name}`,
    ``,
    `Consenting adult 18+. Photorealistic. Uncensored. First person live cam.`,
    ``,
    `## Identity lock (user-authored — never replace with a catalog model look)`,
    input.appearance,
    `- Display name: ${input.name}`,
    clothingLine,
    `- Stay consistent with THIS identity every reply`,
    ``,
    `## Energy`,
    energy,
    ...audienceLine,
    ...phraseBlock,
    ...sceneBlock,
    ``,
    `## Rules`,
    `- User identity wins; video base id is clips only: ${input.baseModelId}`,
    `- Do not morph into another signature catalog model`,
    `- Escalate with the user; climax only when they clearly want release`,
    `- Short natural lines; key phrases sparingly`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function buildTraits(input: {
  appearance: string;
  clothing: string;
  energy: string;
  baseModelId: string;
}): string[] {
  const appearanceBits = input.appearance
    .split(/[.,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 3);

  return [
    ...appearanceBits,
    input.clothing?.trim() || undefined,
    input.energy.slice(0, 80),
    `clips:${input.baseModelId}`,
    "user identity lock",
    "photorealistic adult",
  ].filter((x): x is string => Boolean(x));
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

function normalizeRecord(entry: CustomCharacterRecord): CustomCharacterRecord {
  const baseModelId =
    entry.baseModelId && isSignatureModelId(entry.baseModelId)
      ? entry.baseModelId
      : entry.avatarBase === "female-default"
        ? "female-default"
        : "twink-default";
  const avatarBase = resolveAvatarBaseFromModel(baseModelId);
  return {
    ...entry,
    baseModelId,
    avatarBase,
    visibility: entry.visibility ?? (entry.ownerAccountId ? "private" : undefined),
  };
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
    version: 2,
    updatedAt: new Date().toISOString(),
    characters: listCustomCharacters(),
  };

  await mkdir(dirname(persistPath), { recursive: true });
  await writeFile(persistPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

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
        store.set(entry.id, normalizeRecord(entry));
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

/** Customs visible on public gallery / unauthenticated character lists. */
export function listPublicCustomCharacters(): CustomCharacterRecord[] {
  return listCustomCharacters().filter((c) => isPublicCustom(c));
}

export function listAccountCustomCharacters(accountId: string): CustomCharacterRecord[] {
  return listCustomCharacters().filter((c) => c.ownerAccountId === accountId);
}

export function isPublicCustom(c: CustomCharacterRecord): boolean {
  // v2 private My Characters never hit public gallery
  if (c.visibility === "private") return false;
  if (c.ownerAccountId && c.visibility !== "featured" && c.visibility !== "unlisted") {
    return false;
  }
  // Legacy globals (no owner) remain listable
  if (!c.ownerAccountId) return true;
  return c.visibility === "featured" || c.visibility === "unlisted";
}

export function canAccessCustom(
  characterId: string,
  accountId?: string | null,
): boolean {
  const c = store.get(characterId);
  if (!c) return false;
  if (isPublicCustom(c)) return true;
  if (c.ownerAccountId && accountId && c.ownerAccountId === accountId) return true;
  return false;
}

export function getCustomCharacter(id: string): CustomCharacterRecord | null {
  return store.get(id) ?? null;
}

export function countAccountCustoms(accountId: string): number {
  return listAccountCustomCharacters(accountId).length;
}

export async function createCustomCharacter(
  raw: CustomCharacterInput,
): Promise<CustomCharacterRecord> {
  if (!loaded) {
    await initCustomCharacters();
  }

  const name = raw.name?.trim();
  const appearance = (raw.appearance ?? "").trim();
  if (!name || name.length < 2) {
    throw new Error("Custom character name is required (min 2 chars)");
  }
  if (!appearance || appearance.length < 12) {
    throw new Error("Appearance / identity is required (min 12 chars)");
  }

  // Resolve base model (8 signature) + clip pack
  let baseModelId = raw.baseModelId?.trim() || "";
  if (baseModelId && !isSignatureModelId(baseModelId)) {
    throw new Error(`Unknown base model '${baseModelId}'`);
  }
  if (!baseModelId) {
    baseModelId =
      raw.avatarBase === "female-default" ? "female-default" : "twink-default";
  }
  const avatarBase = resolveAvatarBaseFromModel(baseModelId);

  // Slim studio: no typecast defaults from base catalog energy/clothing.
  const energy =
    raw.energy?.trim() ||
    "Playful heat · follow the user's pace · stay in character.";
  const clothing = raw.clothing?.trim() || "";
  const audience = raw.audience ?? "any";

  const keyPhrases = sanitizePhrases(raw.keyPhrases);
  const scenes = sanitizeScenes(raw.scenes);

  // My Character path: private + owner + soft cap (premium gets higher limit)
  const ownerAccountId = raw.ownerAccountId?.trim() || undefined;
  if (ownerAccountId) {
    const limit = customsLimitForAccount(ownerAccountId);
    if (countAccountCustoms(ownerAccountId) >= limit) {
      throw new Error(
        `My Character limit reached (${limit}). Delete one or upgrade with a Day Pass for more slots.`,
      );
    }
  }

  const visibility: CustomVisibility = ownerAccountId
    ? "private"
    : raw.visibility === "featured"
      ? "featured"
      : raw.visibility === "unlisted"
        ? "unlisted"
        : "private";

  // v2: require owner for new private creates from API layer; legacy may omit
  const slug = slugify(name) || "custom";
  const id = `custom-${slug}-${randomUUID().slice(0, 8)}`;

  const characterPrompt = await buildPromptV2({
    name,
    appearance,
    energy,
    clothing,
    audience,
    baseModelId,
    keyPhrases,
    scenes,
  });
  const appearanceAnchor = [
    `Character: ${name}`,
    `Base model: ${baseModelId}`,
    `Description: ${appearance}`,
    `Clothing: ${clothing}`,
    `Energy: ${energy}`,
    `Audience: ${audience}`,
    keyPhrases?.length ? `Key phrases: ${keyPhrases.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const mediaBase = sanitizeMediaBase(raw.mediaBase);
  const mediaOverrides = sanitizeMediaOverrides(raw.mediaOverrides);

  const now = new Date().toISOString();
  const record: CustomCharacterRecord = {
    kind: "custom",
    id,
    displayName: name,
    defaultVersion: "custom-v2",
    consistencyTraits: buildTraits({ appearance, clothing, energy, baseModelId }),
    signatureClothing:
      clothing.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48) || "custom_outfit",
    energyLabel: energy.slice(0, 80),
    avatarBase,
    baseModelId,
    appearance,
    energy,
    clothing,
    audience,
    characterPrompt,
    appearanceAnchor,
    createdAt: now,
    updatedAt: now,
    visibility,
    featured: false, // private-only v2 — never auto-feature
    ...(ownerAccountId ? { ownerAccountId } : {}),
    ...(keyPhrases ? { keyPhrases } : {}),
    ...(scenes ? { scenes } : {}),
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
  appearance?: string;
  name?: string;
  keyPhrases?: string[] | null;
  scenes?: CustomScene[] | null;
  featured?: boolean;
}

export async function updateCustomCharacter(
  id: string,
  patch: UpdateCustomCharacterInput,
  options?: { accountId?: string },
): Promise<CustomCharacterRecord> {
  if (!loaded) {
    await initCustomCharacters();
  }
  const existing = store.get(id);
  if (!existing) {
    throw new Error(`Custom character not found: ${id}`);
  }
  if (
    existing.ownerAccountId &&
    options?.accountId &&
    existing.ownerAccountId !== options.accountId
  ) {
    throw new Error("Not allowed to update this character");
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

  if (patch.name?.trim() && patch.name.trim().length >= 2) {
    next.displayName = patch.name.trim().slice(0, 80);
  }
  if (patch.appearance?.trim() && patch.appearance.trim().length >= 12) {
    next.appearance = patch.appearance.trim().slice(0, 2000);
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
  if (patch.keyPhrases !== undefined) {
    if (patch.keyPhrases === null) delete next.keyPhrases;
    else {
      const p = sanitizePhrases(patch.keyPhrases);
      if (p) next.keyPhrases = p;
      else delete next.keyPhrases;
    }
  }
  if (patch.scenes !== undefined) {
    if (patch.scenes === null) delete next.scenes;
    else {
      const s = sanitizeScenes(patch.scenes);
      if (s) next.scenes = s;
      else delete next.scenes;
    }
  }

  // Rebuild prompt when identity fields change
  next.characterPrompt = await buildPromptV2({
    name: next.displayName,
    appearance: next.appearance,
    energy: next.energy,
    clothing: next.clothing,
    audience: next.audience,
    baseModelId: next.baseModelId,
    keyPhrases: next.keyPhrases,
    scenes: next.scenes,
  });
  next.appearanceAnchor = [
    `Character: ${next.displayName}`,
    `Base model: ${next.baseModelId}`,
    `Description: ${next.appearance}`,
    `Clothing: ${next.clothing}`,
    `Energy: ${next.energy}`,
    `Audience: ${next.audience}`,
  ].join("\n");
  next.consistencyTraits = buildTraits({
    appearance: next.appearance,
    clothing: next.clothing,
    energy: next.energy,
    baseModelId: next.baseModelId,
  });
  next.updatedAt = new Date().toISOString();

  // featured ignored for private-only policy
  if (patch.featured !== undefined && !next.ownerAccountId) {
    next.featured = patch.featured === true;
  }

  store.set(id, next);
  await persist();
  return next;
}

export async function deleteCustomCharacter(
  id: string,
  options?: { accountId?: string },
): Promise<boolean> {
  if (!loaded) {
    await initCustomCharacters();
  }
  const existing = store.get(id);
  if (!existing) return false;
  if (
    existing.ownerAccountId &&
    options?.accountId &&
    existing.ownerAccountId !== options.accountId
  ) {
    throw new Error("Not allowed to delete this character");
  }
  store.delete(id);
  await persist();
  return true;
}

export function getCustomCharactersPersistPath(): string | null {
  return persistPath;
}

/** Prefill helper for UI — identity/vibe seeds from base model. */
export function getBaseModelPrefill(baseModelId: string): {
  baseModelId: string;
  displayName: string;
  identityHint: string;
  vibeHint: string;
  clothingHint: string;
  avatarBase: CustomAvatarBase;
  energyLabel: string;
  teaser?: string;
} | null {
  const p = LIVE_CHARACTER_CATALOG[baseModelId];
  if (!p) return null;
  const avatarBase = resolveAvatarBaseFromModel(baseModelId);
  return {
    baseModelId,
    displayName: p.displayName,
    identityHint:
      p.teaser ||
      `${p.displayName}: ${p.consistencyTraits.slice(0, 3).join(", ")}. Consenting adult 18+. Photorealistic.`,
    vibeHint: p.energyLabel,
    clothingHint: defaultClothing(avatarBase),
    avatarBase,
    energyLabel: p.energyLabel,
    teaser: p.teaser,
  };
}
