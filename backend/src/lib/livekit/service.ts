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

/** RoomServiceClient expects https:// — clients connect via wss:// */
export function normalizeLiveKitApiHost(url: string): string {
  return url
    .trim()
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://")
    .replace(/\/$/, "");
}

export function normalizeLiveKitClientUrl(url: string): string {
  return url
    .trim()
    .replace(/^https:\/\//i, "wss://")
    .replace(/^http:\/\//i, "ws://")
    .replace(/\/$/, "");
}

export class LiveKitService {
  private readonly client: RoomServiceClient | null;
  private readonly clientUrl: string | null;

  constructor(private readonly config: LiveKitConfig | null) {
    if (config) {
      const apiHost = normalizeLiveKitApiHost(config.url);
      this.client = new RoomServiceClient(apiHost, config.apiKey, config.apiSecret);
      this.clientUrl = normalizeLiveKitClientUrl(config.url);
    } else {
      this.client = null;
      this.clientUrl = null;
    }
  }

  get isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  get serverUrl(): string | null {
    return this.clientUrl;
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
    if (!this.config || !this.clientUrl) {
      throw new Error("LiveKit is not configured");
    }

    await this.ensureRoom(roomName);

    return {
      url: this.clientUrl,
      token: await this.createJoinToken(roomName, identity),
      roomName,
    };
  }

  async ensureRoom(roomName: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.createRoom({
        name: roomName,
        emptyTimeout: 600,
        maxParticipants: 20,
      });
    } catch {
      // Room already exists — fine
    }
  }

  async syncAvatarState(roomName: string, avatar: AvatarState): Promise<void> {
    if (!this.client) return;

    const metadata: LiveKitRoomMetadata = {
      avatar,
      updatedAt: Date.now(),
    };

    try {
      await this.ensureRoom(roomName);
      await this.client.updateRoomMetadata(roomName, JSON.stringify(metadata));
    } catch (error) {
      console.warn(`[livekit] metadata sync failed for room ${roomName}:`, error);
    }
  }

  /** Smoke-test API credentials (creates + deletes a throwaway room). */
  async verifyConnection(): Promise<{ ok: true; room: string } | { ok: false; error: string }> {
    if (!this.client) {
      return { ok: false, error: "LiveKit is not configured" };
    }

    const testRoom = `lk-verify-${Date.now()}`;

    try {
      await this.client.createRoom({ name: testRoom, emptyTimeout: 60 });
      await this.client.updateRoomMetadata(
        testRoom,
        JSON.stringify({ avatar: { emotion: "idle" }, updatedAt: Date.now() }),
      );
      await this.client.deleteRoom(testRoom);
      return { ok: true, room: testRoom };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
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