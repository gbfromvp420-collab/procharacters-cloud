import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import type { AvatarState } from "../../types/session.js";

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export interface LiveKitJoinInfo {
  url: string;
  token: string;
  roomName: string;
}

export interface LiveKitRoomMetadata {
  avatar: AvatarState;
  updatedAt: number;
}

export class LiveKitService {
  private readonly client: RoomServiceClient | null;

  constructor(private readonly config: LiveKitConfig | null) {
    this.client = config
      ? new RoomServiceClient(config.url, config.apiKey, config.apiSecret)
      : null;
  }

  get isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  get serverUrl(): string | null {
    return this.config?.url ?? null;
  }

  async createJoinToken(roomName: string, identity: string): Promise<string> {
    if (!this.config) {
      throw new Error("LiveKit is not configured");
    }

    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity,
      ttl: "2h",
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canSubscribe: true,
      canPublish: false,
      canPublishData: false,
    });

    return await token.toJwt();
  }

  async buildJoinInfo(roomName: string, identity: string): Promise<LiveKitJoinInfo> {
    if (!this.config) {
      throw new Error("LiveKit is not configured");
    }

    return {
      url: this.config.url,
      token: await this.createJoinToken(roomName, identity),
      roomName,
    };
  }

  async syncAvatarState(roomName: string, avatar: AvatarState): Promise<void> {
    if (!this.client) return;

    const metadata: LiveKitRoomMetadata = {
      avatar,
      updatedAt: Date.now(),
    };

    try {
      await this.client.updateRoomMetadata(roomName, JSON.stringify(metadata));
    } catch (error) {
      // Room may not exist until the first participant joins — non-fatal for MVP
      console.warn(`[livekit] metadata sync skipped for room ${roomName}:`, error);
    }
  }
}

export function parseRoomMetadata(raw: string | undefined): LiveKitRoomMetadata | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LiveKitRoomMetadata;
    if (parsed?.avatar && typeof parsed.updatedAt === "number") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}