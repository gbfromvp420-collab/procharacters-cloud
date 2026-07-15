import type { FastifyPluginAsync } from "fastify";
import type { LiveKitService } from "../lib/livekit/service.js";

export const createHealthRoutes = (livekit: LiveKitService): FastifyPluginAsync => {
  return async (app) => {
    app.get("/", async () => ({
      service: "procharacters-backend",
      status: "ok",
      health: "/health",
    }));

    app.get("/health", async () => ({
      status: "ok",
      service: "procharacters-backend",
      version: "0.1.0",
      livekit: {
        configured: livekit.isConfigured,
        url: livekit.isConfigured ? livekit.serverUrl : null,
        /** Ops badge: ready = keys present; live only when a client joins a room. */
        badge: livekit.isConfigured ? "ready" : "off",
      },
      avatar: {
        clipSlots: ["idle", "teasing", "playful", "aroused"],
        energyBands: ["idle", "tease", "play", "edge"],
      },
    }));
  };
};