import { LIVE_RESPONSE_FORMAT } from "../../config/constants.js";

export function buildLiveFormatInstructions(
  characterEnergy: string,
  presenceAvatarHint?: string,
): string {
  return [
    LIVE_RESPONSE_FORMAT,
    "",
    `Character energy to maintain: ${characterEnergy}`,
    presenceAvatarHint?.trim() || "",
    "Never blend identities. Never drop signature clothing or arousal details.",
    "avatar_intent must match this character’s presence bias — not a generic tease for every model.",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function buildConsistencyBlock(traits: string[], appearanceAnchor: string): string {
  return [
    "## Character consistency (required every reply)",
    "",
    "Signature traits you must preserve:",
    ...traits.map((trait) => `- ${trait}`),
    "",
    "## Appearance anchor",
    appearanceAnchor,
  ].join("\n");
}