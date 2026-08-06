import { getCustomCharacter } from "../live/custom-characters.js";
import { resolveAvatarBaseId } from "../live/character-catalog.js";
import { pickClipFromDnaIntensity } from "../live/forge-dna.js";
import { getPresenceProfile } from "../live/presence-profiles.js";
import type { AvatarState } from "../../types/session.js";
import { resolvePackMediaIds } from "./avatar-packs.js";

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
  show_off: "playful",

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

const CLIP_TO_BAND: Record<ClipKey, EnergyBand> = {
  idle: "idle",
  teasing: "tease",
  playful: "play",
  aroused: "edge",
};

const BAND_TO_CLIP: Record<EnergyBand, ClipKey> = {
  idle: "idle",
  tease: "teasing",
  play: "playful",
  edge: "aroused",
};

function isEnergyBand(value: string | undefined): value is EnergyBand {
  return value === "idle" || value === "tease" || value === "play" || value === "edge";
}

/** Map avatar intent → energy band for UI badges. */
export function resolveEnergyBand(state: AvatarState, characterId?: string): EnergyBand {
  return CLIP_TO_BAND[pickClipName(state, characterId)];
}

/**
 * Sticky clip pick — honor Grok emotion, but require a real cross on arousal
 * edges so LiveKit/WS dual-publish doesn't thrash loops every turn.
 */
function pickClipName(state: AvatarState, characterId?: string): ClipKey {
  const raw = pickClipNameRaw(state, characterId);
  const prevBand = isEnergyBand(state.energyBand) ? state.energyBand : undefined;
  if (!prevBand) return raw;

  const prevClip = BAND_TO_CLIP[prevBand];
  if (prevClip === raw) return raw;

  // Hard emotion / action maps may jump bands intentionally — keep those.
  const emotion = normalizeToken(state.emotion);
  const action = normalizeToken(state.action ?? "");
  const emotionMapped = !!EMOTION_TO_CLIP[emotion];
  const actionHard =
    /edge|stroke|freeze|denial|climax|hip|grind|show|flex|hover|tease|trace/.test(action);

  if (emotionMapped || actionHard) {
    // Still soft-stick one notch on pure arousal push-ups from idle/tease.
    if (
      EMOTION_TO_CLIP[emotion] === "teasing" &&
      raw === "aroused" &&
      prevBand === "tease" &&
      state.arousalLevel < 0.82
    ) {
      return "teasing";
    }
    if (
      EMOTION_TO_CLIP[emotion] === "idle" &&
      raw === "teasing" &&
      prevBand === "idle" &&
      state.arousalLevel < 0.6
    ) {
      return "idle";
    }
    return raw;
  }

  // Arousal-only path: wider exit thresholds than entry (hysteresis).
  return applyArousalHysteresis(state.arousalLevel, prevClip, raw);
}

function applyArousalHysteresis(
  arousal: number,
  prev: ClipKey,
  next: ClipKey,
): ClipKey {
  // Stay in edge until cool enough; enter edge only when hot.
  if (prev === "aroused" && next !== "aroused" && arousal >= 0.64) return "aroused";
  if (prev !== "aroused" && next === "aroused" && arousal < 0.72) return prev;

  // Stay in tease until clear drop / clear rise past play.
  if (prev === "teasing" && next === "idle" && arousal >= 0.38) return "teasing";
  if (prev === "teasing" && next === "playful" && arousal < 0.52 && arousal >= 0.38) {
    return "teasing";
  }

  // Stay playful unless we clearly cool or heat.
  if (prev === "playful" && next === "idle" && arousal >= 0.22) return "playful";
  if (prev === "playful" && next === "teasing" && arousal < 0.52 && arousal >= 0.28) {
    return "playful";
  }

  // Stay idle until we clearly leave rest.
  if (prev === "idle" && next !== "idle" && arousal < 0.32) return "idle";

  return next;
}

function pickClipNameRaw(state: AvatarState, characterId?: string): ClipKey {
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

  // Studio Forge DNA intensity map (custom-v3) — arousal → band from forged meta
  if (characterId) {
    const dna = getCustomCharacter(characterId)?.dna;
    const fromDna = pickClipFromDnaIntensity(dna, state.arousalLevel ?? 0);
    if (fromDna) return fromDna;
  }

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
 * 3. Dedicated pack under /avatar/<characterId>/ when ready (Phase 4 drop-in)
 * 4. Interim avatarBase pack (twink-default / female-default)
 */
export function resolveClipPath(characterId: string, state: AvatarState): string {
  const clip = pickClipName(state, characterId);
  const custom = getCustomCharacter(characterId);

  if (custom?.mediaOverrides?.[clip]) {
    const override = normalizeMediaUrl(custom.mediaOverrides[clip]!);
    if (override) return override;
  }

  if (custom?.mediaBase?.trim()) {
    return joinMediaBase(custom.mediaBase.trim(), clip);
  }

  if (custom) {
    const mediaId = custom.avatarBase ?? resolveAvatarBaseId(characterId);
    return `/avatar/${mediaId}/${clip}.mp4`;
  }

  const { primary } = resolvePackMediaIds(characterId);
  return `/avatar/${primary}/${clip}.mp4`;
}

export function resolveClipFallbackPath(
  characterId: string,
  state: AvatarState,
): string | undefined {
  const custom = getCustomCharacter(characterId);
  if (custom) return undefined;
  const clip = pickClipName(state, characterId);
  const { primary, fallback } = resolvePackMediaIds(characterId);
  if (!fallback || fallback === primary) return undefined;
  return `/avatar/${fallback}/${clip}.mp4`;
}

export function enrichAvatarWithMedia(characterId: string, state: AvatarState): AvatarState {
  const mediaUrl = resolveClipPath(characterId, state);
  const mediaFallbackUrl = resolveClipFallbackPath(characterId, state);
  const presenceSkin =
    state.presenceSkin ?? getPresenceProfile(characterId).presenceSkin;
  const energyBand = resolveEnergyBand(state, characterId);
  return {
    ...state,
    mediaUrl,
    ...(mediaFallbackUrl ? { mediaFallbackUrl } : {}),
    energyBand,
    presenceSkin,
    // Always refresh so LiveKit room metadata + WS share a common recency clock
    updatedAt: Date.now(),
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
