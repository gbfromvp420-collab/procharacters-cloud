import type { AvatarState } from "../types/session.js";

/** Avatar state helpers — session text memory lives in SessionMemoryService. */
export class MemoryManager {
  defaultAvatarState(characterId: string): AvatarState {
    const isTwink = characterId === "twink-default";
    return {
      emotion: "teasing",
      pose: "idle",
      action: "subtle_movement",
      arousalLevel: 0.2,
      clothingState: isTwink ? "sheer_thong_visible" : "crotchless_visible",
    };
  }
}