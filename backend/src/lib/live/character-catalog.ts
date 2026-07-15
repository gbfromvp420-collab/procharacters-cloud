import { getCustomCharacter } from "./custom-characters.js";

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
}

/** Built-in v2 live characters — both use v1.3.0 prompts from the library. */
export const LIVE_CHARACTER_CATALOG: Record<string, LiveCharacterProfile> = {
  "twink-default": {
    id: "twink-default",
    displayName: "Twink Default",
    defaultVersion: "v1.3.0",
    kind: "default",
    avatarBase: "twink-default",
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
};

export const LIVE_CHARACTER_IDS = Object.keys(LIVE_CHARACTER_CATALOG);

export function getLiveCharacterProfile(characterId: string): LiveCharacterProfile | null {
  const builtIn = LIVE_CHARACTER_CATALOG[characterId];
  if (builtIn) return builtIn;

  const custom = getCustomCharacter(characterId);
  if (!custom) return null;

  return {
    id: custom.id,
    displayName: custom.displayName,
    defaultVersion: custom.defaultVersion,
    consistencyTraits: custom.consistencyTraits,
    signatureClothing: custom.signatureClothing,
    energyLabel: custom.energyLabel,
    avatarBase: custom.avatarBase,
    kind: "custom",
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

export function assertLiveCharacter(characterId: string): LiveCharacterProfile {
  const profile = getLiveCharacterProfile(characterId);
  if (!profile) {
    throw new LiveCharacterError(
      `Character '${characterId}' is not enabled for live sessions. Create a custom character or use: ${LIVE_CHARACTER_IDS.join(", ")}`,
    );
  }
  return profile;
}