import { getLiveCharacterProfile, resolveAvatarBaseId } from "../lib/live/character-catalog.js";
import type { AvatarState } from "../types/session.js";

/** Avatar state helpers — session text memory lives in SessionMemoryService. */
export class MemoryManager {
  defaultAvatarState(characterId: string): AvatarState {
    const profile = getLiveCharacterProfile(characterId);
    const base = resolveAvatarBaseId(characterId);
    const clothing =
      profile?.signatureClothing ??
      (base === "female-default" ? "crotchless_visible" : "sheer_thong_visible");

    return {
      emotion: "teasing",
      pose: "idle",
      action: "subtle_movement",
      arousalLevel: 0.2,
      clothingState: clothing,
    };
  }
}