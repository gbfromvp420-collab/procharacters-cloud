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
 * v2.0 uses pre-made loops/stills in frontend/public/avatar/{character}/{clip}.svg
 * Replace with .mp4 loops when production assets are ready.
 */
export function resolveClipPath(characterId: string, state: AvatarState): string {
  const clip = pickClipName(state);
  return `/avatar/${characterId}/${clip}.svg`;
}

export function enrichAvatarWithMedia(characterId: string, state: AvatarState): AvatarState {
  return {
    ...state,
    mediaUrl: resolveClipPath(characterId, state),
  };
}