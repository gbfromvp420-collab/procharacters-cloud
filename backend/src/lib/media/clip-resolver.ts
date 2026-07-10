import { getCustomCharacter } from "../live/custom-characters.js";
import { resolveAvatarBaseId } from "../live/character-catalog.js";
import type { AvatarState } from "../../types/session.js";

export const CLIP_KEYS = ["idle", "teasing", "playful", "aroused"] as const;
export type ClipKey = (typeof CLIP_KEYS)[number];

const EMOTION_CLIPS = new Set([
  "teasing",
  "aroused",
  "playful",
  "intense",
  "dominant",
  "submissive",
  "breathless",
  "idle",
]);

const POSE_CLIPS = new Set(["idle", "leaning", "kneeling", "standing"]);

/** Map freeform Grok emotions onto the four clip slots we ship. */
const EMOTION_TO_CLIP: Record<string, ClipKey> = {
  idle: "idle",
  teasing: "teasing",
  playful: "playful",
  aroused: "aroused",
  intense: "aroused",
  dominant: "aroused",
  submissive: "teasing",
  breathless: "aroused",
  leaning: "idle",
  kneeling: "teasing",
  standing: "idle",
};

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pickClipName(state: AvatarState): ClipKey {
  const emotion = normalizeToken(state.emotion);
  const pose = normalizeToken(state.pose);

  if (EMOTION_TO_CLIP[emotion]) return EMOTION_TO_CLIP[emotion];
  if (EMOTION_CLIPS.has(emotion) && CLIP_KEYS.includes(emotion as ClipKey)) {
    return emotion as ClipKey;
  }
  if (POSE_CLIPS.has(pose) && EMOTION_TO_CLIP[pose]) return EMOTION_TO_CLIP[pose];
  if (state.arousalLevel >= 0.7) return "aroused";
  if (state.arousalLevel >= 0.4) return "teasing";
  return "idle";
}

function normalizeMediaUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  // Allow pack-relative paths like avatar/foo/teasing.mp4
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

  // Fuzzy: if Grok said "intense" but only override is aroused, already mapped via pickClipName.
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
    teasing: resolveClipPath(characterId, { ...baseState, emotion: "teasing", arousalLevel: 0.4 }),
    playful: resolveClipPath(characterId, { ...baseState, emotion: "playful", arousalLevel: 0.35 }),
    aroused: resolveClipPath(characterId, { ...baseState, emotion: "aroused", arousalLevel: 0.85 }),
  };
}
