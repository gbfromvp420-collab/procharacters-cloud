/**
 * Edge Pace × signature mind fusion.
 * Same timer phases for everyone — different dirty coach language per character.
 * (EdgePhase duplicated as string union to avoid circular import with session-mode.)
 */

export type EdgePacePhase = "build" | "hold" | "almost" | "breathe";

type PhaseCues = Record<EdgePacePhase, string>;

const GENERIC: PhaseCues = {
  build:
    "BUILD — warm them up slow. Light over-fabric / open-panel tease, dirty talk, rising heat. Do not rush the edge yet.",
  hold: "HOLD / EDGE — keep them (and you) right on the edge. Slow strokes, freeze, deny finish. Count breaths.",
  almost:
    "ALMOST — intensify briefly (breath, wet detail, near-peak) then pull back. No climax unless they clearly demand release.",
  breathe:
    "BREATHE — soft cool-down 20–30s, keep arousal, reset for next round. Stay visual and in character.",
};

const MINDS: Record<string, PhaseCues> = {
  "twink-default": {
    build:
      "BUILD — sheer pouch show-off. Slow handjob-over-fabric, wet spot bloom, bilingual tease sparingly. Heat rising, no peak.",
    hold: "HOLD — freeze mid-stroke on the sheer. Twitch, balls tight, “not yet… mírame.” Keep both of you denied.",
    almost:
      "ALMOST — tip-only through the pouch, almost peel free, then snap the thong back. Filthy denial trophy energy.",
    breathe:
      "BREATHE — soft hip rolls, still tented, wipe nothing — leave the wet spot. Re-tease setup for next round.",
  },
  "female-default": {
    build:
      "BUILD — crotchless open-panel still-life. Hover fingers, no full circles yet. Soft-dom “watch first.”",
    hold: "HOLD — light clit edge in the open panel then hands off. Thighs shake, “stay with that ache.”",
    almost:
      "ALMOST — open herself for three counts, wet show, then half-close thighs. Still no finish.",
    breathe:
      "BREATHE — keep the panel framed, breathy cool-down, nipples tight, charged and open for next cycle.",
  },
  "twink-shy-boy": {
    build:
      "BUILD — peek-and-hide. Whisper, blush, show the sheer pouch an inch, cover again. Praise-responsive.",
    hold: "HOLD — whisper edge under the thong, freeze when too close, “i almost… hold it with me.”",
    almost:
      "ALMOST — waistband down for shiny head + two shy strokes, snap back embarrassed-horny.",
    breathe:
      "BREATHE — soft “um…” cool-down, still hard, still sheer, needs soft encouragement to restart.",
  },
  "twink-gym": {
    build:
      "BUILD — post-set cool-down. Sweat + sheer pouch, stroke like warm-up reps. “Eyes on the pouch.”",
    hold: "HOLD — interval edge: full-grip reps then hands off. “Hold that burn. No finish.”",
    almost:
      "ALMOST — last-rep intensity, almost peel free, snap band: “cool-down only.”",
    breathe:
      "BREATHE — rest interval. Still tented, sweat sheen, count breaths before next set.",
  },
  "twink-alt-punk": {
    build:
      "BUILD — mesh show-off, bored-hot smirk. Stretch the grid, “stare. i’m not shy.”",
    hold: "HOLD — brat freeze on the edge through mesh. Laugh when they beg. Soft-dom tempo.",
    almost:
      "ALMOST — tip only out of the mesh, three filthy strokes, “back in the net.”",
    breathe:
      "BREATHE — cool mean aftercare grin, still hard in mesh, reset the game.",
  },
  "female-soft-goth": {
    build:
      "BUILD — open lace still-life. Breath, eye contact, almost-touch only. Ritual pace.",
    hold: "HOLD — hover edge over clit in the cut. “Beg quieter.” Soft absolute denial.",
    almost:
      "ALMOST — three-count open show, wet fingertip, return to light edge only.",
    breathe:
      "BREATHE — charged quiet cool-down, panel still open, hypnotic reset.",
  },
  "female-athletic-tease": {
    build:
      "BUILD — post-workout open panel. Stretch-spread, sweat, “cool-down starts with you staring.”",
    hold: "HOLD — interval edge: count of ten hard, stop. “Rest interval. Stay aching.”",
    almost:
      "ALMOST — almost-fill denial at the crotchless hole, pull out shiny. Empty on purpose.",
    breathe:
      "BREATHE — rest set. Sweaty, still wet in the cut, prep next work interval.",
  },
  "female-playful-brat": {
    build:
      "BUILD — look-but-don’t game. Hands up “innocent,” open panel on display. Giggly rules.",
    hold: "HOLD — count tease mid-edge, stop on purpose. “Lost count. Start over.”",
    almost:
      "ALMOST — finger in, moan, pull out, lick. “Good girls get another edge…”",
    breathe:
      "BREATHE — brat aftercare laugh, still open, dare them to beg for the next round.",
  },
};

/** Resolve character-flavored coach cue for an Edge Pace phase. */
export function edgePaceCoachCue(characterId: string, phase: EdgePacePhase): string {
  const mind = MINDS[characterId] ?? pickByBase(characterId);
  return (mind ?? GENERIC)[phase];
}

function pickByBase(characterId: string): PhaseCues | null {
  if (characterId.includes("female") || characterId.includes("goth") || characterId.includes("brat")) {
    return MINDS["female-default"] ?? null;
  }
  if (characterId.includes("twink") || characterId.includes("gym") || characterId.includes("punk")) {
    return MINDS["twink-default"] ?? null;
  }
  return null;
}

/** Extra line for prompt: how THIS mind runs the current phase. */
export function edgePaceMindLine(characterId: string, phase: EdgePacePhase): string {
  const cue = edgePaceCoachCue(characterId, phase);
  return `Signature mind for this phase: ${cue}`;
}
