import type { AvatarState } from "@/lib/types";

/**
 * Prefer the fresher avatar body so LiveKit room metadata cannot stomp a
 * newer WebSocket `avatar_update` / `assistant_complete` (or vice versa).
 * Equal timestamps → take incoming (latest writer wins).
 */
export function shouldApplyAvatarUpdate(
  current: AvatarState | null | undefined,
  incoming: AvatarState | null | undefined,
): boolean {
  if (!incoming) return false;
  if (!current) return true;

  const curTs = typeof current.updatedAt === "number" ? current.updatedAt : 0;
  const nextTs = typeof incoming.updatedAt === "number" ? incoming.updatedAt : 0;

  // No clocks yet — always apply (legacy sessions).
  if (!curTs && !nextTs) return true;
  // Incoming is unstamped but we have a clock → still apply if media/emotion moved.
  if (!nextTs && curTs) {
    return (
      incoming.mediaUrl !== current.mediaUrl ||
      incoming.emotion !== current.emotion ||
      incoming.energyBand !== current.energyBand ||
      incoming.arousalLevel !== current.arousalLevel
    );
  }
  return nextTs >= curTs;
}

export function mergeAvatarState(
  current: AvatarState | null | undefined,
  incoming: AvatarState | null | undefined,
): AvatarState | null {
  if (!incoming) return current ?? null;
  if (!shouldApplyAvatarUpdate(current, incoming)) return current ?? null;
  return incoming;
}
