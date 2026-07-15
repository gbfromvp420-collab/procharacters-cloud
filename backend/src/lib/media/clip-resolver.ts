import { getCustomCharacter } from "../live/custom-characters.js";
import { resolveAvatarBaseId } from "../live/character-catalog.js";
import type { AvatarState } from "../../types/session.js";

/** Shipped loop slots (files on disk). */
export const CLIP_KEYS = ["idle", "teasing", "playful", "aroused"] as const;
export type ClipKey = (typeof CLIP_KEYS)[number];

/**
 * Expanded energy vocabulary Grok may emit — all map onto the four loop files.
 * Phase 7: richer labels for UX + better clip picking without new MP4s yet.
 */
export type EnergyBand = "idle" | "tease" | "play" | "edge";

const EMOTION_TO_CLIP: Record<string, ClipKey> = {
  // calm band → idle
  idle: "idle",
  calm: "idle",
  soft: "idle",
  resting: "idle",
  leaning: "idle",
  standing: "idle",
  goth_still: "idle",
  cool_down: "idle",

  // tease band → teasing
  teasing: "teasing",
  seductive: "teasing",
  flirty: "teasing",
  seduction: "teasing",
  submissive: "teasing",
  inviting: "teasing",
  shy: "teasing",
  blushing: "teasing",
  whisper: "teasing",
  kneeling: "teasing",
  soft_dom: "teasing",
  soft_domme: "teasing",

  // play band → playful
  playful: "playful",
  bratty: "playful",
  cocky: "playful",
  brat: "playful",
  smirk: "playful",
  gamey: "playful",
  gym_pulse: "playful",
  showing_off: "playful",

  // edge / high heat → aroused
  aroused: "aroused",
  intense: "aroused",
  breathless: "aroused",
  edging: "aroused",
  edge: "aroused",
  dominant: "aroused",
  close: "aroused",
  desperate: "aroused",
  pulsing: "aroused",
  denial: "aroused",
};

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Map avatar intent → energy band for UI badges. */
export function resolveEnergyBand(state: AvatarState): EnergyBand {
  const clip = pickClipName(state);
  if (clip === "aroused") return "edge";
  if (clip === "playful") return "play";
  if (clip === "teasing") return "tease";
  return "idle";
}

function pickClipName(state: AvatarState): ClipKey {
  const emotion = normalizeToken(state.emotion);
  const pose = normalizeToken(state.pose);
  const action = normalizeToken(state.action ?? "");

  // Explicit emotion map first
  if (EMOTION_TO_CLIP[emotion]) {
    const mapped = EMOTION_TO_CLIP[emotion]!;
    // Arousal can push tease → edge when already hot
    if (mapped === "teasing" && state.arousalLevel >= 0.78) return "aroused";
    if (mapped === "idle" && state.arousalLevel >= 0.55) return "teasing";
    return mapped;
  }

  // Action-driven hints
  if (/edge|stroke|freeze|denial|climax/.test(action)) {
    return state.arousalLevel >= 0.45 ? "aroused" : "teasing";
  }
  if (/hover|tease|trace|look/.test(action)) return "teasing";
  if (/hip|grind|show|flex/.test(action)) return "playful";

  if (EMOTION_TO_CLIP[pose]) return EMOTION_TO_CLIP[pose]!;

  // Arousal bands (fallback)
  if (state.arousalLevel >= 0.72) return "aroused";
  if (state.arousalLevel >= 0.48) return "teasing";
  if (state.arousalLevel >= 0.28) return "playful";
  return "idle";
}

function normalizeMediaUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\/+/, "")}`;
}

function joinMediaBase(base: string, clip: ClipKey): string {
  const cleaned = base.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(cleaned)) {
    return `${cleaned}/${clip}.mp4`;
  }
  const path = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return `${path}/${clip}.mp4`;
}

/**
 * Maps avatar intent to a client-served clip path/URL.
 *
 * Resolution order:
 * 1. Custom per-emotion mediaOverrides
 * 2. Custom mediaBase folder (e.g. /avatar/packs/diego)
 * 3. Built-in pack for avatarBase (twink-default / female-default)
 */
export function resolveClipPath(characterId: string, state: AvatarState): string {
  const clip = pickClipName(state);
  const custom = getCustomCharacter(characterId);

  if (custom?.mediaOverrides?.[clip]) {
    const override = normalizeMediaUrl(custom.mediaOverrides[clip]!);
    if (override) return override;
  }

  if (custom?.mediaBase?.trim()) {
    return joinMediaBase(custom.mediaBase.trim(), clip);
  }

  const mediaId = custom?.avatarBase ?? resolveAvatarBaseId(characterId);
  return `/avatar/${mediaId}/${clip}.mp4`;
}

export function enrichAvatarWithMedia(characterId: string, state: AvatarState): AvatarState {
  return {
    ...state,
    mediaUrl: resolveClipPath(characterId, state),
    energyBand: resolveEnergyBand(state),
  };
}

/** Preview all four clips for a character (UI picker / debugging). */
export function listClipUrls(characterId: string): Record<ClipKey, string> {
  const baseState: AvatarState = {
    emotion: "idle",
    pose: "idle",
    action: "subtle_movement",
    arousalLevel: 0.2,
    clothingState: "default",
  };

  return {
    idle: resolveClipPath(characterId, { ...baseState, emotion: "idle", arousalLevel: 0.1 }),
    teasing: resolveClipPath(characterId, {
      ...baseState,
      emotion: "teasing",
      arousalLevel: 0.4,
    }),
    playful: resolveClipPath(characterId, {
      ...baseState,
      emotion: "playful",
      arousalLevel: 0.35,
    }),
    aroused: resolveClipPath(characterId, {
      ...baseState,
      emotion: "aroused",
      arousalLevel: 0.85,
    }),
  };
}
