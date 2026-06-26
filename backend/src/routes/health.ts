import type { FastifyPluginAsync } from "fastify";
import type { LiveKitService } from "../lib/livekit/service.js";

export const createHealthRoutes = (livekit: LiveKitService): FastifyPluginAsync => {
  return async (app) => {
    app.get("/health", async () => ({
      status: "ok",
      service: "procharacters-backend",
      version: "0.1.0",
      livekit: {
        configured: livekit.isConfigured,
        url: livekit.isConfigured ? livekit.serverUrl : null,
      },
    }));
  };
};