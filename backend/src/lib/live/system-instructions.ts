import { LIVE_RESPONSE_FORMAT } from "../../config/constants.js";

export function buildLiveFormatInstructions(characterEnergy: string): string {
  return [
    LIVE_RESPONSE_FORMAT,
    "",
    `Character energy to maintain: ${characterEnergy}`,
    "Never blend identities. Never drop signature clothing or arousal details.",
  ].join("\n");
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