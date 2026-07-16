import type { FastifyPluginAsync } from "fastify";
import type { LiveKitService } from "../lib/livekit/service.js";
import { accountsProvider } from "../lib/accounts/account-store.js";
import { isStripeConfigured } from "../lib/billing/stripe-billing.js";
import {
  buildPackStatusFile,
  listPackStatuses,
  phase4PackIds,
} from "../lib/media/avatar-packs.js";
import { isErrorReportingConfigured } from "../lib/observability/error-reporter.js";
import { getMetrics } from "../lib/observability/metrics.js";
import { pingPrisma } from "../lib/prisma.js";
import { isWebPushConfigured } from "../lib/push/web-push-service.js";

export const createHealthRoutes = (livekit: LiveKitService): FastifyPluginAsync => {
  return async (app) => {
    app.get("/", async () => ({
      service: "procharacters-backend",
      status: "ok",
      health: "/health",
      metrics: "/metrics",
    }));

    app.get("/health", async () => {
      const provider = accountsProvider();
      const accounts: {
        provider: "json" | "prisma";
        databaseConfigured: boolean;
        database?: { ok: boolean; latencyMs?: number; error?: string };
      } = {
        provider,
        databaseConfigured: !!process.env.DATABASE_URL?.trim(),
      };
      if (provider === "prisma") {
        accounts.database = await pingPrisma();
      }

      return {
        status: "ok",
        service: "procharacters-backend",
        version: "0.1.0",
        accounts,
        livekit: {
          configured: livekit.isConfigured,
          url: livekit.isConfigured ? livekit.serverUrl : null,
          /** Ops badge: ready = keys present; live only when a client joins a room. */
          badge: livekit.isConfigured ? "ready" : "off",
        },
        avatar: {
          clipSlots: ["idle", "teasing", "playful", "aroused"],
          energyBands: ["idle", "tease", "play", "edge"],
          phase4Packs: phase4PackIds(),
          dedicatedReady: listPackStatuses()
            .filter((p) => phase4PackIds().includes(p.id) && p.ready)
            .map((p) => p.id),
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
      };
    });

    /** Lightweight ops metrics (in-process counters). */
    app.get("/metrics", async () => ({
      service: "procharacters-backend",
      accountsProvider: accountsProvider(),
      ...getMetrics(),
    }));

    /** Avatar pack readiness (Phase 4 drop-in). */
    app.get("/avatar-packs", async () => ({
      ...buildPackStatusFile(),
      packs: listPackStatuses(),
    }));
  };
};