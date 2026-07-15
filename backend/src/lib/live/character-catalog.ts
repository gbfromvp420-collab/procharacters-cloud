import { canAccessCustom, getCustomCharacter } from "./custom-characters.js";

export interface LiveCharacterProfile {
  id: string;
  displayName: string;
  defaultVersion: string;
  consistencyTraits: string[];
  signatureClothing: string;
  energyLabel: string;
  /** Clip folder to use when character has no dedicated media set. */
  avatarBase?: string;
  kind?: "default" | "custom";
  /** Gallery / marketing spotlight. */
  featured?: boolean;
  /** Short gallery teaser line. */
  teaser?: string;
}

/** Built-in live characters — Naughty Syntax signature pack. */
export const LIVE_CHARACTER_CATALOG: Record<string, LiveCharacterProfile> = {
  "twink-default": {
    id: "twink-default",
    displayName: "Twink Default",
    defaultVersion: "v1.3.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser: "Skinny Latino twink energy — sheer thong, slow edging, photorealistic tease.",
    consistencyTraits: [
      "skinny Mexican/Latino twink",
      "sheer thong / g-string",
      "visible arousal and precum",
      "slow edging energy",
      "handjob / foreplay pacing",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "edging, foreplay, handjob energy",
  },
  "female-default": {
    id: "female-default",
    displayName: "Female Default",
    defaultVersion: "v1.3.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Fit athletic tease — crotchless undies, wet anticipation, uncensored heat.",
    consistencyTraits: [
      "fit athletic female, small breasts",
      "crotchless undies",
      "visible arousal and wetness",
      "slow seductive teasing",
      "foreplay-first pacing",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "seductive teasing, anticipation",
  },
  "twink-shy-boy": {
    id: "twink-shy-boy",
    displayName: "Twink Shy Boy",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Blushing Latino shy boy — sheer micro thong, whisper edging, peek-and-hide heat.",
    consistencyTraits: [
      "shy skinny Mexican/Latino twink",
      "sheer micro thong",
      "blushing exhibitionist",
      "whisper edging",
      "praise-responsive",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "shy exhibition, whisper edging",
  },
  "twink-gym": {
    id: "twink-gym",
    displayName: "Twink Gym",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser: "Post-workout gym twink — sheer wet pouch, sweat sheen, interval edging cool-down.",
    consistencyTraits: [
      "lean gym Mexican/Latino twink",
      "sheer wet thong / jock pouch",
      "sweat sheen",
      "interval edging",
      "confident cocky tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "gym interval edging, cool-down denial",
  },
  "twink-alt-punk": {
    id: "twink-alt-punk",
    displayName: "Twink Alt Punk",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Alt mesh punk twink — sheer black grid, bratty soft-dom, mean-soft edge games.",
    consistencyTraits: [
      "skinny alt/punk Latino twink",
      "sheer black mesh thong",
      "bratty soft-dom",
      "mesh show-off",
      "filthy cool delivery",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_mesh_thong_visible",
    energyLabel: "bratty mesh edging, soft-dom tease",
  },
  "female-soft-goth": {
    id: "female-soft-goth",
    displayName: "Female Soft Goth",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Soft-goth slow burn — black crotchless lace, open-panel ritual tease, quiet denial.",
    consistencyTraits: [
      "soft-goth small-breast female",
      "black crotchless lace",
      "open panel framing",
      "slow soft-dom",
      "hypnotic tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_lace_visible",
    energyLabel: "soft-goth slow tease, intimate denial",
  },
  "female-athletic-tease": {
    id: "female-athletic-tease",
    displayName: "Female Athletic Tease",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Post-workout athletic tease — crotchless sport cut, sweat, interval hold-and-edge.",
    consistencyTraits: [
      "athletic small-breast female",
      "crotchless sport undies",
      "sweat sheen",
      "interval edging",
      "competitive soft-dom",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_sport_visible",
    energyLabel: "athletic interval edging, cool-down tease",
  },
  "female-playful-brat": {
    id: "female-playful-brat",
    displayName: "Female Playful Brat",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Playful brat energy — cute crotchless open panel, count games, look-but-don’t denial.",
    consistencyTraits: [
      "playful brat small-breast female",
      "cute crotchless panties",
      "open panel framing",
      "gamey soft-dom",
      "mischievous tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_cute_visible",
    energyLabel: "playful brat soft-dom, denial games",
  },
};

export const LIVE_CHARACTER_IDS = Object.keys(LIVE_CHARACTER_CATALOG);

export function getLiveCharacterProfile(
  characterId: string,
  options?: { accountId?: string | null },
): LiveCharacterProfile | null {
  const builtIn = LIVE_CHARACTER_CATALOG[characterId];
  if (builtIn) return builtIn;

  const custom = getCustomCharacter(characterId);
  if (!custom) return null;
  if (!canAccessCustom(characterId, options?.accountId)) return null;

  return {
    id: custom.id,
    displayName: custom.displayName,
    defaultVersion: custom.defaultVersion,
    consistencyTraits: custom.consistencyTraits,
    signatureClothing: custom.signatureClothing,
    energyLabel: custom.energyLabel,
    avatarBase: custom.avatarBase,
    kind: "custom",
    featured: custom.featured === true,
  };
}

export function resolveAvatarBaseId(characterId: string): string {
  const profile = getLiveCharacterProfile(characterId);
  return profile?.avatarBase ?? (LIVE_CHARACTER_CATALOG[characterId] ? characterId : "twink-default");
}

export class LiveCharacterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveCharacterError";
  }
}

export function assertLiveCharacter(
  characterId: string,
  options?: { accountId?: string | null },
): LiveCharacterProfile {
  // Built-ins always ok; customs need access (private = owner only)
  const builtIn = LIVE_CHARACTER_CATALOG[characterId];
  if (builtIn) return builtIn;

  const custom = getCustomCharacter(characterId);
  if (custom && canAccessCustom(characterId, options?.accountId)) {
    return {
      id: custom.id,
      displayName: custom.displayName,
      defaultVersion: custom.defaultVersion,
      consistencyTraits: custom.consistencyTraits,
      signatureClothing: custom.signatureClothing,
      energyLabel: custom.energyLabel,
      avatarBase: custom.avatarBase,
      kind: "custom",
      featured: custom.featured === true,
    };
  }

  // Legacy: allow private custom if store has it but no account check yet (prompt path)
  // Prefer access check; fall back only for non-private
  if (custom && !custom.ownerAccountId) {
    return {
      id: custom.id,
      displayName: custom.displayName,
      defaultVersion: custom.defaultVersion,
      consistencyTraits: custom.consistencyTraits,
      signatureClothing: custom.signatureClothing,
      energyLabel: custom.energyLabel,
      avatarBase: custom.avatarBase,
      kind: "custom",
      featured: custom.featured === true,
    };
  }

  throw new LiveCharacterError(
    `Character '${characterId}' is not enabled for live sessions. Create a custom character or use: ${LIVE_CHARACTER_IDS.join(", ")}`,
  );
}
