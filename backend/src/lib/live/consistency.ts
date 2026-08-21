import type { LiveCharacterProfile } from "./character-catalog.js";

/**
 * Soft post-check for character drift. Returns traits missing from the response.
 * Used for logging and optional single retry — not hard censorship.
 */
export function detectMissingTraits(response: string, traits: string[]): string[] {
  const lower = response.toLowerCase();
  return traits.filter((trait) => {
    const keywords = trait
      .toLowerCase()
      .split(/\s*\/\s*|\s+/)
      .filter((w) => w.length > 3);
    return !keywords.some((word) => lower.includes(word));
  });
}

export function buildConsistencyReminder(
  profile: LiveCharacterProfile,
  missingTraits: string[],
): string {
  if (missingTraits.length === 0) {
    return "";
  }

  return [
    "CONSISTENCY REMINDER: Your last reply drifted off-character.",
    `Re-embody ${profile.displayName} with these traits: ${profile.consistencyTraits.join("; ")}.`,
    `Especially: ${missingTraits.join(", ")}.`,
  ].join(" ");
}
