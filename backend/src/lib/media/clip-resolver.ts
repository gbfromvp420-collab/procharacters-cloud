import { resolveAvatarBaseId } from "../live/character-catalog.js";
import type { AvatarState } from "../../types/session.js";

const EMOTION_CLIPS = new Set([
  "teasing",
  "aroused",
  "playful",
  "intense",
  "dominant",
  "submissive",
  "breathless",
]);

const POSE_CLIPS = new Set(["idle", "leaning", "kneeling", "standing"]);

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pickClipName(state: AvatarState): string {
  const emotion = normalizeToken(state.emotion);
  const pose = normalizeToken(state.pose);

  if (EMOTION_CLIPS.has(emotion)) return emotion;
  if (POSE_CLIPS.has(pose)) return pose;
  if (state.arousalLevel >= 0.7) return "aroused";
  if (state.arousalLevel >= 0.4) return "teasing";
  return "idle";
}

/**
 * Maps avatar intent to a client-served clip path.
 * Loops live in frontend/public/avatar/{character}/{clip}.mp4
 * (run `npm run generate:avatar-loops` to regenerate placeholders).
 */
export function resolveClipPath(characterId: string, state: AvatarState): string {
  const clip = pickClipName(state);
  // Custom characters reuse default model clip packs (no dedicated footage yet).
  const mediaId = resolveAvatarBaseId(characterId);
  return `/avatar/${mediaId}/${clip}.mp4`;
}

export function enrichAvatarWithMedia(characterId: string, state: AvatarState): AvatarState {
  return {
    ...state,
    mediaUrl: resolveClipPath(characterId, state),
  };
}