/**
 * Avatar brain — Grok’s mind is the source of life; clips are muscles.
 *
 * Product doctrine (King Grok):
 * - Intelligence / personality / pacing live in the LLM + presence profiles
 * - Video loops only express energy bands; they never “generate” the character
 * - Smooth, intentional body language > thrashing clips every token
 * - Edge Pace phases steer the body when the mind is in paced mode
 */

import type { AvatarState } from "../../types/session.js";
import { getCustomCharacter } from "./custom-characters.js";
import type { EdgePhase, SessionMode } from "./session-mode.js";
import { getPresenceProfile } from "./presence-profiles.js";

/** Max arousal jump per turn (keeps edge climbs human, not binary). */
const MAX_AROUSAL_UP = 0.18;
const MAX_AROUSAL_DOWN = 0.22;

export interface AvatarBrainContext {
  /** Phase 10 mode — couples timers into body language. */
  sessionMode?: SessionMode;
  edgePhase?: EdgePhase;
  /** Studio Forge DNA tree soft bias (emotion/pose/action/arousal floors). */
  dnaTreeBias?: {
    emotion?: string;
    pose?: string;
    action?: string;
    arousalFloor?: number;
    arousalCeiling?: number;
  };
}

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
function presenceDriftArousal(
  characterId: string,
  previous: number,
  ctx?: AvatarBrainContext,
): number {
  const base = getPresenceProfile(characterId).defaults.arousalLevel;
  const phase = ctx?.sessionMode === "edge_pace" ? ctx.edgePhase : undefined;

  if (phase === "build") {
    return clamp01(Math.max(previous, base) + 0.05);
  }
  if (phase === "hold") {
    return clamp01(Math.max(previous, 0.72) + 0.03);
  }
  if (phase === "almost") {
    return clamp01(Math.max(previous, 0.82) + 0.04);
  }
  if (phase === "breathe") {
    // Cool-down but stay charged
    return clamp01(Math.min(previous, 0.58) - 0.04);
  }

  // Normal mode: slow climb toward a soft ceiling
  // DNA evolution.pace (custom-v3) biases climb speed without thrashing.
  const dnaPace = getCustomCharacter(characterId)?.dna?.evolution?.pace;
  const paceBoost =
    typeof dnaPace === "number" && Number.isFinite(dnaPace)
      ? (Math.min(1, Math.max(0, dnaPace)) - 0.5) * 0.04
      : 0;
  const ceiling = Math.min(0.92, base + 0.48 + (dnaPace && dnaPace > 0.65 ? 0.04 : 0));
  if (previous >= ceiling - 0.02) {
    return clamp01(ceiling - 0.01);
  }
  return clamp01(previous + 0.04 + base * 0.02 + paceBoost);
}

/** When Grok omits emotion during Edge Pace, body still tracks the phase. */
function phaseEmotionFallback(
  characterId: string,
  previousEmotion: string | undefined,
  ctx?: AvatarBrainContext,
): string | undefined {
  if (ctx?.sessionMode !== "edge_pace" || !ctx.edgePhase) {
    return undefined;
  }
  const presence = getPresenceProfile(characterId).defaults.emotion;
  switch (ctx.edgePhase) {
    case "build":
      return previousEmotion && previousEmotion !== "idle" ? previousEmotion : presence;
    case "hold":
      return "edging";
    case "almost":
      return "breathless";
    case "breathe":
      return "soft";
    default:
      return undefined;
  }
}

function phaseActionFallback(ctx?: AvatarBrainContext): string | undefined {
  if (ctx?.sessionMode !== "edge_pace" || !ctx.edgePhase) return undefined;
  switch (ctx.edgePhase) {
    case "build":
      return "hover_touch";
    case "hold":
      return "freeze_edge";
    case "almost":
      return "stroke_over_fabric";
    case "breathe":
      return "subtle_movement";
    default:
      return undefined;
  }
}

/**
 * Merge Grok avatar_intent with sticky presence + smooth arousal + Edge Pace body.
 * This is the single “brain → body” choke point for live sessions.
 */
export function blendAvatarFromBrain(
  characterId: string,
  signatureClothing: string,
  previous: AvatarState,
  fromGrok?: Partial<AvatarState>,
  ctx?: AvatarBrainContext,
): AvatarState {
  const profile = getPresenceProfile(characterId);
  const base = {
    emotion: profile.defaults.emotion,
    pose: profile.defaults.pose,
    action: profile.defaults.action,
    arousalLevel: profile.defaults.arousalLevel,
    clothingState: signatureClothing,
    presenceSkin: profile.presenceSkin,
  };

  const phaseEmotion = phaseEmotionFallback(characterId, previous.emotion, ctx);
  const phaseAction = phaseActionFallback(ctx);
  const tree = ctx?.dnaTreeBias;

  const emotion =
    sanitizeToken(fromGrok?.emotion) ??
    phaseEmotion ??
    sanitizeToken(tree?.emotion) ??
    previous.emotion ??
    base.emotion;
  const pose =
    sanitizeToken(fromGrok?.pose) ?? sanitizeToken(tree?.pose) ?? previous.pose ?? base.pose;
  const action =
    sanitizeToken(fromGrok?.action) ??
    phaseAction ??
    sanitizeToken(tree?.action) ??
    previous.action ??
    base.action;

  let arousalTarget: number;
  if (typeof fromGrok?.arousalLevel === "number") {
    // Still allow Edge Pace to gently floor/ceiling Grok’s number
    arousalTarget = applyPhaseArousalFloor(fromGrok.arousalLevel, ctx);
  } else {
    arousalTarget = presenceDriftArousal(
      characterId,
      previous.arousalLevel ?? base.arousalLevel,
      ctx,
    );
  }

  // DNA tree floors/ceilings (soft — after edge phase floors)
  if (typeof tree?.arousalFloor === "number") {
    arousalTarget = Math.max(arousalTarget, tree.arousalFloor);
  }
  if (typeof tree?.arousalCeiling === "number") {
    arousalTarget = Math.min(arousalTarget, tree.arousalCeiling);
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

function applyPhaseArousalFloor(level: number, ctx?: AvatarBrainContext): number {
  if (ctx?.sessionMode !== "edge_pace" || !ctx.edgePhase) return level;
  switch (ctx.edgePhase) {
    case "hold":
      return Math.max(level, 0.68);
    case "almost":
      return Math.max(level, 0.78);
    case "breathe":
      return Math.min(level, 0.62);
    default:
      return level;
  }
}

function sanitizeToken(value?: string): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const t = value.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 48);
  return t || undefined;
}
