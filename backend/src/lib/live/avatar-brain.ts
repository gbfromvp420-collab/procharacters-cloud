/**
 * Avatar brain — Grok’s mind is the source of life; clips are muscles.
 *
 * Product doctrine (King Grok):
 * - Intelligence / personality / pacing live in the LLM + presence profiles
 * - Video loops only express energy bands; they never “generate” the character
 * - Smooth, intentional body language > thrashing clips every token
 */

import type { AvatarState } from "../../types/session.js";
import { getPresenceProfile } from "./presence-profiles.js";

/** Max arousal jump per turn (keeps edge climbs human, not binary). */
const MAX_AROUSAL_UP = 0.18;
const MAX_AROUSAL_DOWN = 0.22;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function smoothArousal(previous: number, target: number): number {
  const prev = clamp01(previous);
  const next = clamp01(target);
  const delta = next - prev;
  if (delta > MAX_AROUSAL_UP) return clamp01(prev + MAX_AROUSAL_UP);
  if (delta < -MAX_AROUSAL_DOWN) return clamp01(prev - MAX_AROUSAL_DOWN);
  return next;
}

/**
 * When Grok omits avatar_intent, drift gently along the character’s presence curve
 * instead of a generic +0.05 every turn.
 */
function presenceDriftArousal(characterId: string, previous: number): number {
  const base = getPresenceProfile(characterId).defaults.arousalLevel;
  // Slow climb toward a soft ceiling ~ base + 0.45, then hold/edge
  const ceiling = Math.min(0.92, base + 0.48);
  if (previous >= ceiling - 0.02) {
    // Soft edge hold — settle near ceiling without thrashing
    return clamp01(ceiling - 0.01);
  }
  return clamp01(previous + 0.04 + base * 0.02);
}

/**
 * Merge Grok avatar_intent with sticky presence + smooth arousal.
 * This is the single “brain → body” choke point for live sessions.
 */
export function blendAvatarFromBrain(
  characterId: string,
  signatureClothing: string,
  previous: AvatarState,
  fromGrok?: Partial<AvatarState>,
): AvatarState {
  const base = {
    emotion: getPresenceProfile(characterId).defaults.emotion,
    pose: getPresenceProfile(characterId).defaults.pose,
    action: getPresenceProfile(characterId).defaults.action,
    arousalLevel: getPresenceProfile(characterId).defaults.arousalLevel,
    clothingState: signatureClothing,
    presenceSkin: getPresenceProfile(characterId).presenceSkin,
  };

  const emotion = sanitizeToken(fromGrok?.emotion) ?? previous.emotion ?? base.emotion;
  const pose = sanitizeToken(fromGrok?.pose) ?? previous.pose ?? base.pose;
  const action = sanitizeToken(fromGrok?.action) ?? previous.action ?? base.action;

  let arousalTarget: number;
  if (typeof fromGrok?.arousalLevel === "number") {
    arousalTarget = fromGrok.arousalLevel;
  } else {
    arousalTarget = presenceDriftArousal(characterId, previous.arousalLevel ?? base.arousalLevel);
  }

  return {
    emotion,
    pose,
    action,
    arousalLevel: smoothArousal(previous.arousalLevel ?? base.arousalLevel, arousalTarget),
    clothingState:
      sanitizeToken(fromGrok?.clothingState) ??
      signatureClothing ??
      previous.clothingState ??
      base.clothingState,
    presenceSkin: previous.presenceSkin ?? base.presenceSkin,
  };
}

function sanitizeToken(value?: string): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const t = value.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 48);
  return t || undefined;
}
