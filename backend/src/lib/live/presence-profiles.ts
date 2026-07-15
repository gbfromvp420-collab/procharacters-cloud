/**
 * Presence profiles — how each signature model “comes alive” on avatar + intent.
 *
 * Architecture choice (v2):
 * - Video = 4 reactive loops (idle/teasing/playful/aroused), not generative talking heads
 * - Character soul = prompts + openings + these defaults + Grok avatar_intent
 * - Until dedicated MP4 packs exist, shared base footage is graded by presenceSkin
 *
 * Drop real clips into /avatar/<id>/ later; profiles keep working either way.
 */

import type { AvatarState } from "../../types/session.js";
import { resolveAvatarBaseId } from "./character-catalog.js";
import { getCustomCharacter } from "./custom-characters.js";

/** Client color/grade keys — keep in sync with frontend/src/lib/presence.ts */
export type PresenceSkin =
  | "twink_default"
  | "twink_shy"
  | "twink_gym"
  | "twink_punk"
  | "female_default"
  | "female_goth"
  | "female_athletic"
  | "female_brat"
  | "custom";

export interface PresenceProfile {
  /** Short directive for Grok avatar_intent each turn */
  avatarHint: string;
  /** Session-start avatar defaults */
  defaults: Pick<AvatarState, "emotion" | "pose" | "action" | "arousalLevel">;
  /** Visual grade key for the client */
  presenceSkin: PresenceSkin;
}

const PROFILES: Record<string, PresenceProfile> = {
  "twink-default": {
    presenceSkin: "twink_default",
    defaults: {
      emotion: "teasing",
      pose: "idle",
      action: "subtle_movement",
      arousalLevel: 0.28,
    },
    avatarHint:
      "Slow edging presence. Prefer emotion teasing→seductive→edging. Actions: stroke_over_fabric, freeze_edge, eye_contact. Rise arousal slowly; never jump to 0.9 in one turn.",
  },
  "female-default": {
    presenceSkin: "female_default",
    defaults: {
      emotion: "seductive",
      pose: "leaning",
      action: "hover_touch",
      arousalLevel: 0.3,
    },
    avatarHint:
      "Athletic tease, foreplay-first. Prefer seductive / flirty / soft_dom. Actions: hover_touch, hip_roll, look_away then eye_contact. Wet anticipation, not frantic.",
  },
  "twink-shy-boy": {
    presenceSkin: "twink_shy",
    defaults: {
      emotion: "shy",
      pose: "leaning",
      action: "look_away",
      arousalLevel: 0.22,
    },
    avatarHint:
      "Blushing shy exhibition. Prefer shy / blushing / whisper, only rarely playful. Actions: look_away, peek eye_contact, subtle_movement. Arousal climbs when praised; dips if rushed.",
  },
  "twink-gym": {
    presenceSkin: "twink_gym",
    defaults: {
      emotion: "cocky",
      pose: "standing",
      action: "hip_roll",
      arousalLevel: 0.35,
    },
    avatarHint:
      "Post-set cool-down intervals. Prefer cocky / playful / edging (gym_pulse energy). Actions: hip_roll, stroke_over_fabric, freeze_edge between “sets”. Arousal pulses in intervals, not a straight climb.",
  },
  "twink-alt-punk": {
    presenceSkin: "twink_punk",
    defaults: {
      emotion: "bratty",
      pose: "standing",
      action: "showing_off",
      arousalLevel: 0.32,
    },
    avatarHint:
      "Mesh brat soft-dom. Prefer bratty / cocky / soft_dom / edging. Actions: showing_off, hip_roll, freeze_edge, mean-soft eye_contact. Filthy cool, never shy-boy energy.",
  },
  "female-soft-goth": {
    presenceSkin: "female_goth",
    defaults: {
      emotion: "soft_dom",
      pose: "kneeling",
      action: "hover_touch",
      arousalLevel: 0.26,
    },
    avatarHint:
      "Hypnotic soft-goth ritual. Prefer soft_dom / seductive / calm then edging. Actions: hover_touch, freeze_edge, eye_contact. Slowest climb of the catalog; denial is intimate, not bratty.",
  },
  "female-athletic-tease": {
    presenceSkin: "female_athletic",
    defaults: {
      emotion: "playful",
      pose: "standing",
      action: "hip_roll",
      arousalLevel: 0.34,
    },
    avatarHint:
      "Interval athletic cool-down. Prefer playful / cocky / intense / edging. Actions: hip_roll, freeze_edge (hold the set), stroke_over_fabric. Competitive soft-dom pacing.",
  },
  "female-playful-brat": {
    presenceSkin: "female_brat",
    defaults: {
      emotion: "bratty",
      pose: "idle",
      action: "look_away",
      arousalLevel: 0.3,
    },
    avatarHint:
      "Cute gamey brat. Prefer bratty / playful / teasing / soft_dom. Actions: look_away, hover_touch, freeze_edge as a dare. Count games energy — denial is fun, not cruel.",
  },
};

const FALLBACK_TWINK: PresenceProfile = {
  presenceSkin: "twink_default",
  defaults: {
    emotion: "teasing",
    pose: "idle",
    action: "subtle_movement",
    arousalLevel: 0.25,
  },
  avatarHint:
    "Teasing edging presence. Vary emotion labels; rise arousal slowly; keep signature clothing visible.",
};

const FALLBACK_FEMALE: PresenceProfile = {
  presenceSkin: "female_default",
  defaults: {
    emotion: "seductive",
    pose: "leaning",
    action: "hover_touch",
    arousalLevel: 0.28,
  },
  avatarHint:
    "Seductive teasing presence. Vary emotion labels; rise arousal slowly; keep crotchless / open-panel framing.",
};

export function getPresenceProfile(characterId: string): PresenceProfile {
  if (PROFILES[characterId]) return PROFILES[characterId]!;

  const custom = getCustomCharacter(characterId);
  if (custom) {
    const base = custom.avatarBase ?? resolveAvatarBaseId(characterId);
    const fromBase = PROFILES[base];
    if (fromBase) {
      return {
        ...fromBase,
        presenceSkin: "custom",
        avatarHint: `${fromBase.avatarHint} Custom overlay: stay true to this character’s name and vibe while using the base model body language.`,
      };
    }
    return {
      presenceSkin: "custom",
      defaults: {
        emotion: "teasing",
        pose: "idle",
        action: "subtle_movement",
        arousalLevel: 0.25,
      },
      avatarHint:
        "Custom character — match their stated energy. Vary avatar_intent; rise arousal slowly.",
    };
  }

  const base = resolveAvatarBaseId(characterId);
  if (base === "female-default" || characterId.includes("female")) {
    return FALLBACK_FEMALE;
  }
  return FALLBACK_TWINK;
}

export function buildPresenceAvatarHint(characterId: string): string {
  const p = getPresenceProfile(characterId);
  return [
    "### This character’s presence (avatar_intent bias)",
    p.avatarHint,
    `Suggested session-start energy: emotion=${p.defaults.emotion}, pose=${p.defaults.pose}, action=${p.defaults.action}, arousal≈${p.defaults.arousalLevel}.`,
  ].join("\n");
}
