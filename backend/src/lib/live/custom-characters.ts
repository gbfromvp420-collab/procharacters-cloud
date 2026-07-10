import { randomUUID } from "node:crypto";
import type { LiveCharacterProfile } from "./character-catalog.js";

export type CustomAvatarBase = "twink-default" | "female-default";

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
}

const store = new Map<string, CustomCharacterRecord>();

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

export function listCustomCharacters(): CustomCharacterRecord[] {
  return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCustomCharacter(id: string): CustomCharacterRecord | null {
  return store.get(id) ?? null;
}

export function createCustomCharacter(raw: CustomCharacterInput): CustomCharacterRecord {
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
  const avatarBase: CustomAvatarBase = raw.avatarBase === "female-default" ? "female-default" : "twink-default";
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

  const record: CustomCharacterRecord = {
    kind: "custom",
    id,
    displayName: name,
    defaultVersion: "custom-v1",
    consistencyTraits: buildTraits({ appearance, clothing, energy }),
    signatureClothing: clothing.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48) || "custom_outfit",
    energyLabel: energy.slice(0, 80),
    avatarBase,
    appearance,
    energy,
    clothing,
    audience,
    characterPrompt,
    appearanceAnchor,
    createdAt: new Date().toISOString(),
  };

  store.set(id, record);
  return record;
}
