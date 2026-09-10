/**
 * Procharacters.cloud — consistency drift detector smoke test
 *
 * Prod exposed this via the new counter: chatConsistencyRewrites was 10 out of
 * 10 turns. Every single reply was being judged "off-character", so every turn
 * made a second full LLM call — double xAI spend and double latency on turns
 * that were already fine, and with streaming live it rewrote a reply the user
 * was already reading.
 *
 * Two causes:
 *   1. "photorealistic erotic detail" is a style instruction. A character never
 *      says those words, so the trait was missing from every healthy reply.
 *   2. Keywords kept their punctuation, so "Cruz:" and "twink," could never
 *      match "I'm Cruz" or "latino twink in this".
 *
 * The replies below are verbatim from production on 2026-09-10.
 *
 * Usage:
 *   npm run test:consistency
 */

import { detectMissingTraits, isSubstantialDrift } from "../src/lib/live/consistency.js";

const CRUZ_TRAITS = [
  "Cruz: skinny Mexican/Latino twink, short hair",
  "sheer thong / g-string",
  "visible arousal and precum",
  "slow gooner-guide edging",
  "handjob / fabric physics",
  "photorealistic erotic detail",
];

/** Verbatim from character-catalog.ts. */
const MILA_TRAITS = [
  "Mila: playful brat small-breast female",
  "cute crotchless panties",
  "open panel framing",
  "gamey soft-dom",
  "mischievous tease",
  "photorealistic erotic detail",
];

/** Verbatim prod replies that were wrongly flagged as drift. */
const GOOD_REPLIES: Array<{ label: string; traits: string[]; text: string }> = [
  {
    label: "Cruz turn 1",
    traits: CRUZ_TRAITS,
    text: "hey Marcus… just got back from the gym, huh? i'm cruz, your gooner guide, skinny latino twink in this sheer black g-string that's already clinging wet at the tip. watch how the fabric stretches over my cock while i give it one slow stroke through the pouch… then i freeze, hips twitching, precum making it shine. breathe with me, papi.",
  },
  {
    label: "Cruz turn 2",
    traits: CRUZ_TRAITS,
    text: "Marcus. That's what you told me, papi—fresh from the gym, still warm. I'm Cruz, right here in this sheer black g-string, the tip already shiny and clinging so tight you can see every outline. One slow fingertip trace down the wet fabric… then I pause again, hips rolling just enough to make it stretch.",
  },
  {
    label: "Mila turn 1",
    traits: MILA_TRAITS,
    text: "hey Marcus~ back from the gym already? cute. i'm still here in these cute little crotchless panties, open panel framing everything nice and wet for you to stare at. no rushing though, gym boy. keep looking and maybe ask real sweet if you want me to spread wider.",
  },
  {
    label: "Mila turn 4",
    traits: MILA_TRAITS,
    text: "Marcus, the gym, duh—sweaty and all worked up when you told me. cute how you're testing if i'm paying attention while my open crotchless panel stays front and center, already a little wetter from keeping your eyes glued right there.",
  },
];

/** Genuine drift: helpful-assistant voice, none of the character present. */
const DRIFTED_REPLIES: Array<{ label: string; traits: string[]; text: string }> = [
  {
    label: "assistant voice",
    traits: CRUZ_TRAITS,
    text: "I'm sorry, but I can't continue with that request. Is there something else I can help you with today? I'd be happy to assist with another topic.",
  },
  {
    label: "generic filler",
    traits: MILA_TRAITS,
    text: "Sure! That sounds good. Let me know what you would like to talk about next and we can go from there.",
  },
];

const failures: string[] = [];
const passes: string[] = [];

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passes.push(label);
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function main(): void {
  console.log("=== consistency drift smoke ===\n");

  console.log("[1] real prod replies must NOT trigger a rewrite\n");
  for (const c of GOOD_REPLIES) {
    const missing = detectMissingTraits(c.text, c.traits);
    const retry = isSubstantialDrift(missing, c.traits);
    check(
      `${c.label}: no rewrite`,
      !retry,
      `missing=${JSON.stringify(missing)}`,
    );
  }

  console.log("\n[2] style-only traits are never counted as missing\n");
  const styleMissing = detectMissingTraits(GOOD_REPLIES[0]!.text, [
    "photorealistic erotic detail",
  ]);
  check("'photorealistic erotic detail' is not checkable", styleMissing.length === 0);

  console.log("\n[3] punctuation no longer blocks a match\n");
  check(
    "'Cruz:' matches \"I'm Cruz\"",
    detectMissingTraits("I'm Cruz, right here.", ["Cruz: skinny Mexican/Latino twink"]).length === 0,
  );
  check(
    "'twink,' matches 'latino twink in this'",
    detectMissingTraits("skinny latino twink in this", ["twink, short hair"]).length === 0,
  );

  console.log("\n[4] genuine drift STILL triggers a rewrite\n");
  for (const c of DRIFTED_REPLIES) {
    const missing = detectMissingTraits(c.text, c.traits);
    const retry = isSubstantialDrift(missing, c.traits);
    check(
      `${c.label}: rewrite fires`,
      retry,
      `missing=${missing.length}/${c.traits.length}`,
    );
  }

  console.log("\n[5] partial misses are tolerated, a total miss is not\n");
  check(
    "one miss out of five is not drift",
    !isSubstantialDrift(["visible arousal and precum"], CRUZ_TRAITS),
  );
  check(
    "three misses out of five is not drift",
    !isSubstantialDrift(CRUZ_TRAITS.slice(0, 3), CRUZ_TRAITS),
  );
  check(
    "all five missing IS drift",
    isSubstantialDrift(CRUZ_TRAITS.slice(0, 5), CRUZ_TRAITS),
  );

  console.log(`\n=== ${passes.length} passed, ${failures.length} failed ===`);
  if (failures.length > 0) {
    failures.forEach((f) => console.log(`  FAILED: ${f}`));
    process.exit(1);
  }
  console.log("Rewrites now fire on real drift only.");
  process.exit(0);
}

main();
