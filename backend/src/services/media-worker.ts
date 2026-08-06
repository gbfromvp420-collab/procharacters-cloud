import { enrichAvatarWithMedia } from "../lib/media/clip-resolver.js";
import type { LiveKitService } from "../lib/livekit/service.js";
import type { AvatarState } from "../types/session.js";

/** Resolves clip URLs and syncs avatar state to LiveKit room metadata. */
export class MediaWorker {
  constructor(private readonly livekit: LiveKitService | null) {}

  enrich(characterId: string, state: AvatarState): AvatarState {
    return enrichAvatarWithMedia(characterId, state);
  }

  async publish(roomName: string, characterId: string, state: AvatarState): Promise<AvatarState> {
    const enriched = this.enrich(characterId, state);

    if (this.livekit?.isConfigured) {
      await this.livekit.syncAvatarState(roomName, enriched);
    }

    return enriched;
  }
}