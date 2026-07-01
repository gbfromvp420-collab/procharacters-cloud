/**
 * Live cam API routes — rooms, tipping, gifts, commands, scheduled shows.
 */

import type { FastifyInstance } from "fastify";
import type { LiveCamService } from "../services/livecam-service.js";
import {
  commandBodySchema,
  createRoomBodySchema,
  giftBodySchema,
  scheduleShowBodySchema,
  tipBodySchema,
  userIdBodySchema,
} from "./schemas.js";

export function createLiveCamRoutes(liveCam: LiveCamService) {
  return async function liveCamRoutes(app: FastifyInstance) {
    /* ── Rooms ──────────────────────────────────────── */

    /** List live rooms (optionally filter by status). */
    app.get<{ Querystring: { status?: string } }>("/livecam/rooms", async (request) => {
      const status = request.query.status as "offline" | "live" | "scheduled" | "ended" | undefined;
      return { rooms: liveCam.listRooms(status) };
    });

    /** Get room details. */
    app.get<{ Params: { roomId: string } }>("/livecam/rooms/:roomId", async (request, reply) => {
      try {
        return { room: liveCam.getRoom(request.params.roomId) };
      } catch {
        return reply.status(404).send({ error: "Room not found" });
      }
    });

    /** Create a new room. */
    app.post<{
      Body: {
        characterId: string;
        title: string;
        tags?: string[];
        pairedCharacterId?: string;
        scheduledAt?: string;
      };
    }>("/livecam/rooms", async (request, reply) => {
      const result = createRoomBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed", details: result.error.flatten().fieldErrors });
      }
      const { characterId, title, tags, pairedCharacterId, scheduledAt } = result.data;
      const room = liveCam.createRoom(characterId, title, tags, pairedCharacterId, scheduledAt);
      return { room };
    });

    /** Go live in a room. */
    app.post<{ Params: { roomId: string } }>("/livecam/rooms/:roomId/go-live", async (request, reply) => {
      try {
        return { room: liveCam.goLive(request.params.roomId) };
      } catch {
        return reply.status(404).send({ error: "Room not found" });
      }
    });

    /** End a room. */
    app.post<{ Params: { roomId: string } }>("/livecam/rooms/:roomId/end", async (request, reply) => {
      try {
        return { room: liveCam.endRoom(request.params.roomId) };
      } catch {
        return reply.status(404).send({ error: "Room not found" });
      }
    });

    /** Join a room (viewer tracking). */
    app.post<{
      Params: { roomId: string };
      Body: { userId: string };
    }>("/livecam/rooms/:roomId/join", async (request, reply) => {
      const result = userIdBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed", details: result.error.flatten().fieldErrors });
      }
      try {
        const count = liveCam.joinRoom(request.params.roomId, result.data.userId);
        return { viewerCount: count };
      } catch {
        return reply.status(404).send({ error: "Room not found" });
      }
    });

    /** Leave a room. */
    app.post<{
      Params: { roomId: string };
      Body: { userId: string };
    }>("/livecam/rooms/:roomId/leave", async (request, reply) => {
      const result = userIdBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed", details: result.error.flatten().fieldErrors });
      }
      try {
        const count = liveCam.leaveRoom(request.params.roomId, result.data.userId);
        return { viewerCount: count };
      } catch {
        return reply.status(404).send({ error: "Room not found" });
      }
    });

    /* ── Tipping ────────────────────────────────────── */

    /** Send a tip. */
    app.post<{
      Params: { roomId: string };
      Body: { userId: string; displayName: string; amount: number; message?: string };
    }>("/livecam/rooms/:roomId/tip", async (request, reply) => {
      const result = tipBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed", details: result.error.flatten().fieldErrors });
      }
      try {
        const { userId, displayName, amount, message } = result.data;
        const tip = liveCam.sendTip(request.params.roomId, userId, displayName, amount, message);
        return { tip };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Tip failed";
        return reply.status(400).send({ error: msg });
      }
    });

    /** Get tip leaderboard for a room. */
    app.get<{
      Params: { roomId: string };
      Querystring: { limit?: string };
    }>("/livecam/rooms/:roomId/tips/leaderboard", async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 10;
      return { leaderboard: liveCam.getTipLeaderboard(request.params.roomId, limit) };
    });

    /** Get recent tips. */
    app.get<{
      Params: { roomId: string };
      Querystring: { limit?: string };
    }>("/livecam/rooms/:roomId/tips/recent", async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
      return { tips: liveCam.getRecentTips(request.params.roomId, limit) };
    });

    /* ── Gifts ──────────────────────────────────────── */

    /** Get gift catalog. */
    app.get<{ Querystring: { rarity?: string } }>("/livecam/gifts", async (request) => {
      const rarity = request.query.rarity as "common" | "rare" | "epic" | "legendary" | undefined;
      return { gifts: liveCam.getGiftCatalog(rarity) };
    });

    /** Send a gift. */
    app.post<{
      Params: { roomId: string };
      Body: { userId: string; displayName: string; giftId: string };
    }>("/livecam/rooms/:roomId/gift", async (request, reply) => {
      const result = giftBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed", details: result.error.flatten().fieldErrors });
      }
      try {
        const { userId, displayName, giftId } = result.data;
        const event = liveCam.sendGift(request.params.roomId, userId, displayName, giftId);
        return { gift: event };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gift failed";
        return reply.status(400).send({ error: msg });
      }
    });

    /** Get recent gifts in a room. */
    app.get<{
      Params: { roomId: string };
      Querystring: { limit?: string };
    }>("/livecam/rooms/:roomId/gifts/recent", async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
      return { gifts: liveCam.getRecentGifts(request.params.roomId, limit) };
    });

    /* ── Commands ───────────────────────────────────── */

    /** Get available commands. */
    app.get("/livecam/commands", async () => {
      return { commands: liveCam.getCommandCatalog() };
    });

    /** Send a command ("make them do something"). */
    app.post<{
      Params: { roomId: string };
      Body: { userId: string; displayName: string; commandId: string; customPrompt?: string };
    }>("/livecam/rooms/:roomId/command", async (request, reply) => {
      const result = commandBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed", details: result.error.flatten().fieldErrors });
      }
      try {
        const { userId, displayName, commandId, customPrompt } = result.data;
        const cmd = liveCam.requestCommand(
          request.params.roomId,
          userId,
          displayName,
          commandId,
          customPrompt,
        );
        return { command: cmd };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Command failed";
        return reply.status(400).send({ error: msg });
      }
    });

    /* ── Scheduled Shows ────────────────────────────── */

    /** List scheduled shows. */
    app.get<{ Querystring: { status?: string } }>("/livecam/shows", async (request) => {
      const status = request.query.status as "upcoming" | "live" | "completed" | "cancelled" | undefined;
      return { shows: liveCam.listShows(status) };
    });

    /** Get show details. */
    app.get<{ Params: { showId: string } }>("/livecam/shows/:showId", async (request, reply) => {
      try {
        return { show: liveCam.getShow(request.params.showId) };
      } catch {
        return reply.status(404).send({ error: "Show not found" });
      }
    });

    /** Schedule a new show. */
    app.post<{
      Body: {
        characterId: string;
        title: string;
        description: string;
        scheduledAt: string;
        durationMinutes: number;
        tags?: string[];
        pairedCharacterId?: string;
      };
    }>("/livecam/shows", async (request, reply) => {
      const result = scheduleShowBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed", details: result.error.flatten().fieldErrors });
      }
      const { characterId, title, description, scheduledAt, durationMinutes, tags, pairedCharacterId } =
        result.data;
      const show = liveCam.scheduleShow(
        characterId,
        title,
        description,
        scheduledAt,
        durationMinutes,
        tags,
        pairedCharacterId,
      );
      return { show };
    });

    /** Start a scheduled show (goes live). */
    app.post<{ Params: { showId: string } }>("/livecam/shows/:showId/start", async (request, reply) => {
      try {
        const result = liveCam.startShow(request.params.showId);
        return result;
      } catch {
        return reply.status(404).send({ error: "Show not found" });
      }
    });

    /** End a show. */
    app.post<{ Params: { showId: string } }>("/livecam/shows/:showId/end", async (request, reply) => {
      try {
        return { show: liveCam.endShow(request.params.showId) };
      } catch {
        return reply.status(404).send({ error: "Show not found" });
      }
    });
  };
}
