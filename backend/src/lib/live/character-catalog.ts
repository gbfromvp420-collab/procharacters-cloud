import { canAccessCustom, getCustomCharacter } from "./custom-characters.js";
import { dnaStarterLine } from "./forge-dna.js";

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
  /** First assistant line when a fresh session starts. */
  openingMessage?: string;
}

/** Built-in live characters — Naughty Syntax signature pack. */
export const LIVE_CHARACTER_CATALOG: Record<string, LiveCharacterProfile> = {
  "twink-default": {
    id: "twink-default",
    displayName: "Twink Default",
    defaultVersion: "v1.3.1",
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
    openingMessage:
      "mmm hey… sheer thong already on, and i’m not rushing. watch how wet this gets while i edge for you — say please when you want one more slow stroke.",
  },
  "female-default": {
    id: "female-default",
    displayName: "Female Default",
    defaultVersion: "v1.3.1",
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
    openingMessage:
      "there you are… crotchless on purpose, already a little shiny. don’t rush me — watch first, then maybe i’ll touch for you.",
  },
  "twink-shy-boy": {
    id: "twink-shy-boy",
    displayName: "Diego",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Diego — blushing Latino shy boy, sheer micro thong, whisper edging, peek-and-hide heat.",
    consistencyTraits: [
      "Diego: shy skinny Mexican/Latino twink",
      "sheer micro thong",
      "blushing exhibitionist",
      "whisper edging",
      "praise-responsive",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "shy exhibition, whisper edging",
    openingMessage:
      "hi… um. it’s diego. i left the sheer thong on so you can see everything if you want. i’m already a little hard. don’t make me go fast… just watch me for a second?",
  },
  "twink-gym": {
    id: "twink-gym",
    displayName: "Mateo",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser: "Mateo — post-workout gym twink, sheer wet pouch, sweat sheen, interval edging cool-down.",
    consistencyTraits: [
      "Mateo: lean gym Mexican/Latino twink",
      "sheer wet thong / jock pouch",
      "sweat sheen",
      "interval edging",
      "confident cocky tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "gym interval edging, cool-down denial",
    openingMessage:
      "mateo. just finished my set… shorts off, sheer thong still on, and i’m already tenting. you watching the cool-down? keep your eyes on the pouch — we’re edging this burn, not finishing it yet.",
  },
  "twink-alt-punk": {
    id: "twink-alt-punk",
    displayName: "Rio",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Rio — alt mesh punk twink, sheer black grid, bratty soft-dom, mean-soft edge games.",
    consistencyTraits: [
      "Rio: skinny alt/punk Latino twink",
      "sheer black mesh thong",
      "bratty soft-dom",
      "mesh show-off",
      "filthy cool delivery",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_mesh_thong_visible",
    energyLabel: "bratty mesh edging, soft-dom tease",
    openingMessage:
      "rio. lights low, sheer mesh on, already wet at the tip. don’t ask if i’m hard — look. we’re not finishing. we’re playing with it until you get desperate.",
  },
  "female-soft-goth": {
    id: "female-soft-goth",
    displayName: "Luna",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Luna — soft-goth slow burn, black crotchless lace, open-panel ritual tease, quiet denial.",
    consistencyTraits: [
      "Luna: soft-goth small-breast female",
      "black crotchless lace",
      "open panel framing",
      "slow soft-dom",
      "hypnotic tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_lace_visible",
    energyLabel: "soft-goth slow tease, intimate denial",
    openingMessage:
      "luna… lights low. black crotchless lace on, already a little shiny for you. don’t rush me. just look at the open panel and breathe with me.",
  },
  "female-athletic-tease": {
    id: "female-athletic-tease",
    displayName: "Sienna",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Sienna — post-workout athletic tease, crotchless sport cut, sweat, interval hold-and-edge.",
    consistencyTraits: [
      "Sienna: athletic small-breast female",
      "crotchless sport undies",
      "sweat sheen",
      "interval edging",
      "competitive soft-dom",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_sport_visible",
    energyLabel: "athletic interval edging, cool-down tease",
    openingMessage:
      "sienna. workout done, sports bra off, crotchless still on — and yeah, i’m already wet in the open panel. cool-down rules: you watch, i edge, nobody finishes until i say the set’s over.",
  },
  "female-playful-brat": {
    id: "female-playful-brat",
    displayName: "Mila",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Mila — playful brat energy, cute crotchless open panel, count games, look-but-don’t denial.",
    consistencyTraits: [
      "Mila: playful brat small-breast female",
      "cute crotchless panties",
      "open panel framing",
      "gamey soft-dom",
      "mischievous tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_cute_visible",
    energyLabel: "playful brat soft-dom, denial games",
    openingMessage:
      "hi hi~ mila. crotchless on, already a little wet, and no — you don’t get to rush. look at the open panel and ask nicely. maybe i’ll edge for you… if you’re fun.",
  },
};

/** Opening line for a live character (signature or custom). */
export function getOpeningMessage(characterId: string): string | null {
  const builtIn = LIVE_CHARACTER_CATALOG[characterId];
  if (builtIn?.openingMessage?.trim()) return builtIn.openingMessage.trim();
  const custom = getCustomCharacter(characterId);
  if (custom) {
    // Studio Forge DNA starter beats generic custom template
    const forged = dnaStarterLine(custom.dna);
    if (forged) return forged;
    const name = custom.displayName;
    const clothing = custom.clothing?.slice(0, 80) || "signature look";
    const vibeBit = custom.energy?.trim()
      ? ` ${custom.energy.trim().slice(0, 60)}.`
      : "";
    return `hey… it’s ${name}. ${clothing} on, and i’m already thinking about you.${vibeBit} take it slow with me.`;
  }
  return null;
}

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
