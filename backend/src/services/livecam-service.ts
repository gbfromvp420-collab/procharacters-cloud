/**
 * Live cam room manager — Feature B core service.
 *
 * Handles room lifecycle, viewer tracking, tipping, gifts,
 * commands, and scheduled shows.
 */

import { v4 as uuid } from "uuid";
import type { AvatarState } from "../types/session.js";
import type {
  CommandDefinition,
  CommandRequest,
  GiftDefinition,
  GiftRarity,
  GiftSendEvent,
  LiveRoom,
  LiveRoomListItem,
  RoomStatus,
  ScheduledShow,
  Tip,
  TipLeaderboardEntry,
} from "../types/livecam.js";
import type { TokenService } from "./token-service.js";

/* ── Built-in gift catalog ──────────────────────────────── */

const GIFT_CATALOG: GiftDefinition[] = [
  { id: "rose", name: "Rose", emoji: "🌹", rarity: "common", cost: 10, effectType: "float", animationDurationMs: 3000 },
  { id: "fire", name: "Fire", emoji: "🔥", rarity: "common", cost: 15, effectType: "burst", animationDurationMs: 2500 },
  { id: "kiss", name: "Kiss", emoji: "💋", rarity: "common", cost: 10, effectType: "float", animationDurationMs: 3000 },
  { id: "diamond", name: "Diamond", emoji: "💎", rarity: "rare", cost: 50, effectType: "burst", animationDurationMs: 4000 },
  { id: "champagne", name: "Champagne", emoji: "🍾", rarity: "rare", cost: 75, effectType: "rain", animationDurationMs: 5000 },
  { id: "crown", name: "Crown", emoji: "👑", rarity: "epic", cost: 200, effectType: "fullscreen", animationDurationMs: 6000 },
  { id: "rocket", name: "Rocket", emoji: "🚀", rarity: "epic", cost: 250, effectType: "fullscreen", animationDurationMs: 5000 },
  { id: "heart-explosion", name: "Heart Explosion", emoji: "💖", rarity: "legendary", cost: 500, effectType: "fullscreen", animationDurationMs: 8000 },
  { id: "vip-throne", name: "VIP Throne", emoji: "🪑", rarity: "legendary", cost: 1000, effectType: "fullscreen", animationDurationMs: 10000 },
];

/* ── Built-in command catalog ───────────────────────────── */

const COMMAND_CATALOG: CommandDefinition[] = [
  {
    id: "wink",
    label: "Wink",
    description: "Make them wink seductively",
    tier: "free",
    cost: 0,
    cooldownSeconds: 30,
    promptFragment: "The viewer just asked you to wink at them. Give a slow, seductive wink and respond playfully.",
    avatarOverride: { emotion: "playful", action: "winking" },
  },
  {
    id: "blow-kiss",
    label: "Blow a Kiss",
    description: "They blow a kiss to the viewer",
    tier: "basic",
    cost: 5,
    cooldownSeconds: 15,
    promptFragment: "Blow a kiss to the viewer. Be flirty and engaging.",
    avatarOverride: { emotion: "flirty", action: "blowing_kiss" },
  },
  {
    id: "strip-tease",
    label: "Strip Tease",
    description: "A slow, seductive strip tease moment",
    tier: "premium",
    cost: 20,
    cooldownSeconds: 60,
    promptFragment: "The viewer is requesting a slow strip tease. Build anticipation with teasing movements, slowly revealing more. Stay in character and make it sensual.",
    avatarOverride: { emotion: "seductive", action: "stripping", arousalLevel: 0.7 },
  },
  {
    id: "dance",
    label: "Dance",
    description: "A sexy dance move",
    tier: "basic",
    cost: 10,
    cooldownSeconds: 30,
    promptFragment: "Do a sexy, confident dance move for the viewer. Own the moment.",
    avatarOverride: { emotion: "confident", action: "dancing" },
  },
  {
    id: "whisper",
    label: "Whisper",
    description: "Whisper something naughty",
    tier: "basic",
    cost: 5,
    cooldownSeconds: 20,
    promptFragment: "Lean in close and whisper something naughty and intimate to the viewer. Make it personal.",
    avatarOverride: { emotion: "intimate", action: "whispering" },
  },
  {
    id: "flex",
    label: "Flex / Show Off",
    description: "Show off their body confidently",
    tier: "basic",
    cost: 10,
    cooldownSeconds: 30,
    promptFragment: "Strike a pose and show off. Be proud and confident. Flaunt what you've got.",
    avatarOverride: { emotion: "confident", action: "posing", pose: "standing" },
  },
  {
    id: "edge",
    label: "Edge",
    description: "An intense edging moment",
    tier: "premium",
    cost: 30,
    cooldownSeconds: 120,
    promptFragment: "The viewer wants you to edge. Build intense, slow pleasure. Describe every sensation. This is the signature Naughty Syntax experience.",
    avatarOverride: { emotion: "intense", action: "edging", arousalLevel: 0.9 },
  },
  {
    id: "custom",
    label: "Custom Request",
    description: "Make a custom request (type your own)",
    tier: "premium",
    cost: 25,
    cooldownSeconds: 45,
    promptFragment: "", // filled dynamically with user's custom text
  },
];

export class LiveCamService {
  private rooms = new Map<string, LiveRoom>();
  private tips: Tip[] = [];
  private giftEvents: GiftSendEvent[] = [];
  private commandRequests: CommandRequest[] = [];
  private scheduledShows: ScheduledShow[] = [];
  private commandCooldowns = new Map<string, number>(); // `userId:commandId` → timestamp
  private roomViewers = new Map<string, Set<string>>(); // roomId → set of userIds

  constructor(private tokenService: TokenService) {}

  /* ── Room management ────────────────────────────────── */

  createRoom(
    characterId: string,
    title: string,
    tags: string[] = [],
    pairedCharacterId?: string,
    scheduledAt?: string,
  ): LiveRoom {
    const room: LiveRoom = {
      id: uuid(),
      characterId,
      pairedCharacterId,
      status: scheduledAt ? "scheduled" : "offline",
      title,
      tags,
      viewerCount: 0,
      peakViewerCount: 0,
      avatarState: {
        emotion: "idle",
        pose: "standing",
        action: "waiting",
        arousalLevel: 0,
        clothingState: characterId.includes("twink") ? "sheer_thong_visible" : "crotchless_visible",
      },
      scheduledAt,
      createdAt: new Date().toISOString(),
    };
    this.rooms.set(room.id, room);
    this.roomViewers.set(room.id, new Set());
    return room;
  }

  goLive(roomId: string): LiveRoom {
    const room = this.getRoom(roomId);
    room.status = "live";
    room.startedAt = new Date().toISOString();
    return room;
  }

  endRoom(roomId: string): LiveRoom {
    const room = this.getRoom(roomId);
    room.status = "ended";
    room.endedAt = new Date().toISOString();
    this.roomViewers.get(roomId)?.clear();
    room.viewerCount = 0;
    return room;
  }

  getRoom(roomId: string): LiveRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new LiveCamError(`Room not found: ${roomId}`);
    return room;
  }

  listRooms(statusFilter?: RoomStatus): LiveRoomListItem[] {
    const rooms = Array.from(this.rooms.values());
    const filtered = statusFilter ? rooms.filter((r) => r.status === statusFilter) : rooms;
    return filtered.map((r) => ({
      id: r.id,
      characterId: r.characterId,
      pairedCharacterId: r.pairedCharacterId,
      status: r.status,
      title: r.title,
      tags: r.tags,
      viewerCount: r.viewerCount,
      thumbnailUrl: r.avatarState.mediaUrl,
    }));
  }

  /* ── Viewer tracking ────────────────────────────────── */

  joinRoom(roomId: string, userId: string): number {
    const room = this.getRoom(roomId);
    const viewers = this.roomViewers.get(roomId)!;
    viewers.add(userId);
    room.viewerCount = viewers.size;
    if (room.viewerCount > room.peakViewerCount) {
      room.peakViewerCount = room.viewerCount;
    }
    return room.viewerCount;
  }

  leaveRoom(roomId: string, userId: string): number {
    const room = this.getRoom(roomId);
    const viewers = this.roomViewers.get(roomId)!;
    viewers.delete(userId);
    room.viewerCount = viewers.size;
    return room.viewerCount;
  }

  getViewerCount(roomId: string): number {
    return this.roomViewers.get(roomId)?.size ?? 0;
  }

  /* ── Tipping ────────────────────────────────────────── */

  sendTip(roomId: string, userId: string, displayName: string, amount: number, message?: string): Tip {
    if (amount < 1) throw new LiveCamError("Minimum tip is 1 token");
    this.getRoom(roomId); // validate room exists

    // Debit tokens
    this.tokenService.debit(userId, amount, "tip", { roomId });

    const tip: Tip = {
      id: uuid(),
      roomId,
      userId,
      displayName,
      amount,
      message,
      createdAt: new Date().toISOString(),
    };
    this.tips.push(tip);
    return tip;
  }

  getTipLeaderboard(roomId: string, limit = 10): TipLeaderboardEntry[] {
    const roomTips = this.tips.filter((t) => t.roomId === roomId);
    const totals = new Map<string, { displayName: string; total: number }>();
    for (const tip of roomTips) {
      const entry = totals.get(tip.userId) ?? { displayName: tip.displayName, total: 0 };
      entry.total += tip.amount;
      totals.set(tip.userId, entry);
    }
    return Array.from(totals.entries())
      .map(([userId, { displayName, total }]) => ({ userId, displayName, totalTipped: total, rank: 0 }))
      .sort((a, b) => b.totalTipped - a.totalTipped)
      .slice(0, limit)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }

  getRecentTips(roomId: string, limit = 20): Tip[] {
    return this.tips.filter((t) => t.roomId === roomId).slice(-limit);
  }

  /* ── Gifts ──────────────────────────────────────────── */

  getGiftCatalog(rarityFilter?: GiftRarity): GiftDefinition[] {
    if (rarityFilter) return GIFT_CATALOG.filter((g) => g.rarity === rarityFilter);
    return [...GIFT_CATALOG];
  }

  sendGift(roomId: string, userId: string, displayName: string, giftId: string): GiftSendEvent {
    this.getRoom(roomId);
    const gift = GIFT_CATALOG.find((g) => g.id === giftId);
    if (!gift) throw new LiveCamError(`Gift not found: ${giftId}`);

    this.tokenService.debit(userId, gift.cost, "gift", { roomId, giftId });

    const event: GiftSendEvent = {
      id: uuid(),
      roomId,
      userId,
      displayName,
      giftId,
      gift,
      createdAt: new Date().toISOString(),
    };
    this.giftEvents.push(event);
    return event;
  }

  getRecentGifts(roomId: string, limit = 20): GiftSendEvent[] {
    return this.giftEvents.filter((g) => g.roomId === roomId).slice(-limit);
  }

  /* ── Commands ("make them do something") ────────────── */

  getCommandCatalog(): CommandDefinition[] {
    return [...COMMAND_CATALOG];
  }

  requestCommand(
    roomId: string,
    userId: string,
    displayName: string,
    commandId: string,
    customPrompt?: string,
  ): CommandRequest {
    this.getRoom(roomId);
    const commandDef = COMMAND_CATALOG.find((c) => c.id === commandId);
    if (!commandDef) throw new LiveCamError(`Command not found: ${commandId}`);

    // Check cooldown
    const cooldownKey = `${userId}:${commandId}`;
    const lastUsed = this.commandCooldowns.get(cooldownKey) ?? 0;
    const now = Date.now();
    if (now - lastUsed < commandDef.cooldownSeconds * 1000) {
      const remaining = Math.ceil((commandDef.cooldownSeconds * 1000 - (now - lastUsed)) / 1000);
      throw new LiveCamError(`Command on cooldown: ${remaining}s remaining`);
    }

    // Debit tokens (skip for free commands)
    if (commandDef.cost > 0) {
      this.tokenService.debit(userId, commandDef.cost, "command_request", { roomId, commandId });
    }

    // For custom commands, inject the user's custom prompt
    const resolvedCommand: CommandDefinition = commandId === "custom" && customPrompt
      ? { ...commandDef, promptFragment: `The viewer has a custom request: "${customPrompt}". Respond naturally and in character.` }
      : commandDef;

    this.commandCooldowns.set(cooldownKey, now);

    const request: CommandRequest = {
      id: uuid(),
      roomId,
      userId,
      displayName,
      commandId,
      command: resolvedCommand,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.commandRequests.push(request);
    return request;
  }

  completeCommand(requestId: string): CommandRequest {
    const req = this.commandRequests.find((r) => r.id === requestId);
    if (!req) throw new LiveCamError(`Command request not found: ${requestId}`);
    req.status = "completed";
    return req;
  }

  /* ── Scheduled shows ────────────────────────────────── */

  scheduleShow(
    characterId: string,
    title: string,
    description: string,
    scheduledAt: string,
    durationMinutes: number,
    tags: string[] = [],
    pairedCharacterId?: string,
  ): ScheduledShow {
    const show: ScheduledShow = {
      id: uuid(),
      characterId,
      pairedCharacterId,
      title,
      description,
      tags,
      scheduledAt,
      durationMinutes,
      status: "upcoming",
      createdAt: new Date().toISOString(),
    };
    this.scheduledShows.push(show);
    return show;
  }

  startShow(showId: string): { show: ScheduledShow; room: LiveRoom } {
    const show = this.scheduledShows.find((s) => s.id === showId);
    if (!show) throw new LiveCamError(`Show not found: ${showId}`);
    show.status = "live";

    const room = this.createRoom(show.characterId, show.title, show.tags, show.pairedCharacterId);
    this.goLive(room.id);
    show.roomId = room.id;

    return { show, room };
  }

  endShow(showId: string): ScheduledShow {
    const show = this.scheduledShows.find((s) => s.id === showId);
    if (!show) throw new LiveCamError(`Show not found: ${showId}`);
    show.status = "completed";
    if (show.roomId) {
      this.endRoom(show.roomId);
    }
    return show;
  }

  listShows(statusFilter?: ScheduledShow["status"]): ScheduledShow[] {
    if (statusFilter) return this.scheduledShows.filter((s) => s.status === statusFilter);
    return [...this.scheduledShows];
  }

  getShow(showId: string): ScheduledShow {
    const show = this.scheduledShows.find((s) => s.id === showId);
    if (!show) throw new LiveCamError(`Show not found: ${showId}`);
    return show;
  }

  /* ── Avatar state updates ───────────────────────────── */

  updateRoomAvatar(roomId: string, avatarState: AvatarState): void {
    const room = this.getRoom(roomId);
    room.avatarState = avatarState;
  }

  updatePairedAvatar(roomId: string, avatarState: AvatarState): void {
    const room = this.getRoom(roomId);
    if (!room.pairedCharacterId) throw new LiveCamError("Room has no paired character");
    room.pairedAvatarState = avatarState;
  }
}

export class LiveCamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveCamError";
  }
}
