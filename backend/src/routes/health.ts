import type { FastifyPluginAsync } from "fastify";
import type { LiveKitService } from "../lib/livekit/service.js";
import { isStripeConfigured } from "../lib/billing/stripe-billing.js";
import { isErrorReportingConfigured } from "../lib/observability/error-reporter.js";
import { getMetrics } from "../lib/observability/metrics.js";
import { isWebPushConfigured } from "../lib/push/web-push-service.js";

export const createHealthRoutes = (livekit: LiveKitService): FastifyPluginAsync => {
  return async (app) => {
    app.get("/", async () => ({
      service: "procharacters-backend",
      status: "ok",
      health: "/health",
      metrics: "/metrics",
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
      observability: {
        errorWebhook: isErrorReportingConfigured(),
        webPush: isWebPushConfigured(),
        logLevel: process.env.LOG_LEVEL?.trim() || "info",
      },
      billing: {
        stripe: isStripeConfigured(),
        freePath: true,
      },
    }));

    /** Lightweight ops metrics (in-process counters). */
    app.get("/metrics", async () => ({
      service: "procharacters-backend",
      ...getMetrics(),
    }));
  };
};