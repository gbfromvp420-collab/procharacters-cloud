import type { FastifyPluginAsync } from "fastify";
import type { LiveKitService } from "../lib/livekit/service.js";
import { accountsProvider } from "../lib/accounts/account-store.js";
import {
  isStripeConfigured,
  isStripeWebhookConfigured,
  stripeMode,
} from "../lib/billing/stripe-billing.js";
import { buildPackStatusFile, listPackStatuses, phase4PackIds } from "../lib/media/avatar-packs.js";
import {
  isErrorEmailConfigured,
  isErrorReportingConfigured,
  isErrorWebhookUrlConfigured,
  primaryAlertChannel,
  sendErrorWebhookTest,
} from "../lib/observability/error-reporter.js";
import { getLastExpiryCron, getMetrics } from "../lib/observability/metrics.js";
import { isGenVideoConfigured } from "../lib/gen-video.js";
import { pingPrisma } from "../lib/prisma.js";
import { isWebPushConfigured } from "../lib/push/web-push-service.js";

/** Global cooldown so the public smoke endpoint can't spam Gary's channel. */
let lastErrorWebhookTestAt = 0;
const ERROR_WEBHOOK_TEST_COOLDOWN_MS = 60_000;

/** Railway / CI inject these so ops can see which commit is live. */
function deployFingerprint(): {
  gitSha: string | null;
  gitShaShort: string | null;
  environment: string | null;
  serviceName: string | null;
} {
  const gitSha =
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    process.env.COMMIT_SHA?.trim() ||
    null;
  return {
    gitSha,
    gitShaShort: gitSha ? gitSha.slice(0, 7) : null,
    environment:
      process.env.RAILWAY_ENVIRONMENT_NAME?.trim() || process.env.NODE_ENV?.trim() || null,
    serviceName: process.env.RAILWAY_SERVICE_NAME?.trim() || null,
  };
}

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
        deploy: deployFingerprint(),
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
          errorWebhookUrl: isErrorWebhookUrlConfigured(),
          errorAlertEmail: isErrorEmailConfigured(),
          alertChannel: primaryAlertChannel(),
          webPush: isWebPushConfigured(),
          logLevel: process.env.LOG_LEVEL?.trim() || "info",
          /** Resume-expiry push cron last tick (null until first run). */
          lastExpiryCron: getLastExpiryCron(),
        },
        billing: {
          stripe: isStripeConfigured(),
          webhook: isStripeWebhookConfigured(),
          mode: stripeMode(),
          freePath: true,
        },
        generativeVideo: {
          configured: isGenVideoConfigured(),
          default: "loops",
          optIn: true,
        },
      };
    });

    /** Lightweight ops metrics (in-process counters). */
    app.get("/metrics", async () => ({
      service: "procharacters-backend",
      accountsProvider: accountsProvider(),
      deploy: deployFingerprint(),
      ...getMetrics(),
    }));

    /** Avatar pack readiness (Phase 4 drop-in). */
    app.get("/avatar-packs", async () => ({
      ...buildPackStatusFile(),
      packs: listPackStatuses(),
    }));

    /**
     * Ops smoke — POST a green test message to ERROR_WEBHOOK_URL.
     * Rate-limited (1/min process-wide). No auth so Account System pulse can fire it;
     * only posts to *your* configured webhook.
     */
    app.post("/api/v1/ops/error-webhook/test", async (request, reply) => {
      if (!isErrorReportingConfigured() || primaryAlertChannel() === "none") {
        return reply.code(503).send({
          ok: false,
          configured: false,
          channel: "none",
          error:
            "No alert channel. Easiest (no Discord): set ERROR_WEBHOOK_URL=https://ntfy.sh/YOUR-SECRET-TOPIC — see docs/ops-error-webhook.md",
        });
      }

      const now = Date.now();
      const waitMs = ERROR_WEBHOOK_TEST_COOLDOWN_MS - (now - lastErrorWebhookTestAt);
      if (waitMs > 0) {
        return reply
          .code(429)
          .header("Retry-After", String(Math.ceil(waitMs / 1000)))
          .send({
            ok: false,
            configured: true,
            channel: primaryAlertChannel(),
            error: `Try again in ${Math.ceil(waitMs / 1000)}s`,
            retryAfterSec: Math.ceil(waitMs / 1000),
          });
      }

      const result = await sendErrorWebhookTest(request.log);
      if (result.sent) {
        lastErrorWebhookTestAt = now;
      }
      return reply.code(result.sent ? 200 : 502).send({
        ok: result.sent,
        configured: result.configured,
        channel: result.channel ?? primaryAlertChannel(),
        status: result.status,
        error: result.error,
      });
    });
  };
};
