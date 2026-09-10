import type { LiveCharacterProfile } from "./character-catalog.js";

/**
 * Words describing how a reply should read rather than anything the character
 * would say. A trait built only from these can never be observed in dialogue,
 * so checking for it reports drift on every healthy reply.
 */
const STYLE_ONLY_WORDS = new Set([
  "photorealistic",
  "realistic",
  "erotic",
  "explicit",
  "vivid",
  "detail",
  "details",
  "physics",
]);

/** Split a trait into searchable words, without leading/trailing punctuation. */
function traitKeywords(trait: string): string[] {
  return trait
    .toLowerCase()
    .split(/[\s/]+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}-]+|[^\p{L}\p{N}-]+$/gu, ""))
    .filter((word) => word.length > 3);
}

/** True when a trait describes prose style, so the reply can't evidence it. */
function isUnobservable(keywords: string[]): boolean {
  return keywords.length > 0 && keywords.every((word) => STYLE_ONLY_WORDS.has(word));
}

/**
 * Soft post-check for character drift. Returns traits missing from the response.
 * Used for logging and optional single retry — not hard censorship.
 *
 * Traits that only describe style are skipped: they are prompt guidance, not
 * vocabulary, so demanding them back would flag every reply as drifted.
 */
export function detectMissingTraits(response: string, traits: string[]): string[] {
  const lower = response.toLowerCase();
  return traits.filter((trait) => {
    const keywords = traitKeywords(trait);
    if (keywords.length === 0 || isUnobservable(keywords)) return false;
    return !keywords.some((word) => lower.includes(word));
  });
}

/**
 * Whether missing traits amount to real drift.
 *
 * Keyword matching only tells us whether the reply echoed specific vocabulary,
 * which is a poor proxy for staying in character: many traits are vibe
 * descriptors ("gamey soft-dom", "mischievous tease") that good prose expresses
 * without ever naming. Partial misses are therefore normal — a brat can be
 * bratty without saying "mischievous".
 *
 * The one case the check reads reliably is a reply containing no trace of the
 * character at all, which is what actual drift looks like ("I'm sorry, but I
 * can't continue with that request"). Re-asking on anything less costs a second
 * full LLM call on a turn that was already fine, and with streaming it visibly
 * rewrites a reply the user is already reading.
 */
export function isSubstantialDrift(missingTraits: string[], allTraits: string[]): boolean {
  const checkable = allTraits.filter((trait) => {
    const keywords = traitKeywords(trait);
    return keywords.length > 0 && !isUnobservable(keywords);
  }).length;
  if (checkable < 2) return false;
  return missingTraits.length >= checkable;
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