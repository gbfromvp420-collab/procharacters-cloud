import { getLiveCharacterProfile, resolveAvatarBaseId } from "../lib/live/character-catalog.js";
import { getPresenceProfile } from "../lib/live/presence-profiles.js";
import type { AvatarState } from "../types/session.js";

/** Avatar state helpers — session text memory lives in SessionMemoryService. */
export class MemoryManager {
  defaultAvatarState(characterId: string): AvatarState {
    const profile = getLiveCharacterProfile(characterId);
    const presence = getPresenceProfile(characterId);
    const base = resolveAvatarBaseId(characterId);
    const clothing =
      profile?.signatureClothing ??
      (base === "female-default" ? "crotchless_visible" : "sheer_thong_visible");

    return {
      emotion: presence.defaults.emotion,
      pose: presence.defaults.pose,
      action: presence.defaults.action,
      arousalLevel: presence.defaults.arousalLevel,
      clothingState: clothing,
      presenceSkin: presence.presenceSkin,
    };
  }
}
