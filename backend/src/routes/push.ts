import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  listPushSubscriptionsForAccount,
  removePushSubscription,
  savePushSubscription,
} from "../lib/push/push-store.js";
import { notifyAccountResumeExpiry } from "../lib/push/expiry-notify.js";
import {
  getVapidPublicKey,
  isWebPushConfigured,
  sendWebPush,
} from "../lib/push/web-push-service.js";
import type { SessionManager } from "../services/session-manager.js";
import { bearerToken } from "./accounts.js";
import { resolveAccountToken } from "../lib/accounts/account-store.js";
import { env } from "../config/env.js";
import { bump } from "../lib/observability/metrics.js";
import {
  RATE_LIMITS,
  clientIp,
  enforceRateLimits,
} from "../lib/rate-limit.js";

function rateLimited(
  reply: import("fastify").FastifyReply,
  result: { retryAfterSec: number; limit: number },
) {
  reply.header("Retry-After", String(result.retryAfterSec));
  reply.header("X-RateLimit-Limit", String(result.limit));
  return reply.code(429).send({
    error: "Too many requests — try again later",
    code: "RATE_LIMITED",
    retryAfterSec: result.retryAfterSec,
  });
}

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(20).max(500),
    auth: z.string().min(8).max(200),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

export const createPushRoutes = (sessionManager: SessionManager): FastifyPluginAsync => {
  return async (app) => {
    app.get("/push/vapid-public-key", async () => {
      return {
        configured: isWebPushConfigured(),
        publicKey: getVapidPublicKey(),
      };
    });

    app.post("/accounts/me/push/subscribe", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      if (!isWebPushConfigured()) {
        return reply.code(503).send({
          error: "Web Push not configured (set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)",
          code: "PUSH_DISABLED",
        });
      }
      try {
        const body = subscribeSchema.parse(request.body ?? {});
        await savePushSubscription({
          accountId: account.id,
          endpoint: body.endpoint,
          keys: body.keys,
          userAgent:
            typeof request.headers["user-agent"] === "string"
              ? request.headers["user-agent"].slice(0, 300)
              : undefined,
        });
        bump("pushSubscribe");
        // Fire expiry check immediately for this account
        const siteBase =
          env.MAGIC_LINK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || undefined;
        const notify = await notifyAccountResumeExpiry(account.id, sessionManager, {
          siteBase,
        });
        return { ok: true, subscribed: true, notify };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        throw error;
      }
    });

    app.delete("/accounts/me/push/subscribe", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      try {
        const body = unsubscribeSchema.parse(request.body ?? {});
        const removed = await removePushSubscription(account.id, body.endpoint);
        return { ok: true, removed };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        throw error;
      }
    });

    /** Subscription status for Account UI (device count + last notify). */
    app.get("/accounts/me/push/status", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const subs = await listPushSubscriptionsForAccount(account.id);
      const lastNotified = subs
        .map((s) => s.lastExpiryNotifyAt)
        .filter((v): v is string => !!v)
        .sort()
        .at(-1);
      return {
        configured: isWebPushConfigured(),
        subscriptionCount: subs.length,
        lastExpiryNotifyAt: lastNotified ?? null,
        devices: subs.map((s) => ({
          endpointTail: s.endpoint.slice(-24),
          createdAt: s.createdAt,
          lastExpiryNotifyAt: s.lastExpiryNotifyAt ?? null,
          userAgent: s.userAgent?.slice(0, 80) ?? null,
        })),
      };
    });

    /** Re-check expiry and push if needed (also used after listing sessions). */
    app.post("/accounts/me/push/check-expiry", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const siteBase =
        env.MAGIC_LINK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || undefined;
      const body = (request.body ?? {}) as { force?: unknown };
      const force = body.force === true;
      const result = await notifyAccountResumeExpiry(account.id, sessionManager, {
        siteBase,
        force,
      });
      return { ok: true, ...result };
    });

    /**
     * Send a one-shot test notification to all devices on this account.
     * Used for phone smoke (Phase 1) without waiting for resume-code expiry.
     */
    app.post("/accounts/me/push/test", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      if (!isWebPushConfigured()) {
        return reply.code(503).send({
          error: "Web Push not configured (set VAPID keys)",
          code: "PUSH_DISABLED",
          configured: false,
        });
      }
      const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
      const denied = enforceRateLimits([
        {
          key: `push-test:acct:${account.id}`,
          limit: RATE_LIMITS.pushTestPerAccount.limit,
          windowMs: RATE_LIMITS.pushTestPerAccount.windowMs,
        },
        {
          key: `push-test:ip:${ip}`,
          limit: RATE_LIMITS.pushTestPerIp.limit,
          windowMs: RATE_LIMITS.pushTestPerIp.windowMs,
        },
      ]);
      if (denied) return rateLimited(reply, denied);

      const siteBase =
        env.MAGIC_LINK_BASE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "https://procharacters-web-production-7288.up.railway.app";
      const subs = await listPushSubscriptionsForAccount(account.id);
      if (subs.length === 0) {
        return reply.code(400).send({
          error: "No push devices on this account — enable push on this browser first",
          code: "NO_SUBSCRIPTIONS",
          sent: 0,
        });
      }
      let sent = 0;
      let failed = 0;
      let gone = 0;
      for (const sub of subs) {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, keys: sub.keys },
          {
            title: "Procharacters · test alert",
            body: "Push works. You'll get similar pings when resume codes expire soon.",
            url: `${siteBase.replace(/\/$/, "")}/account`,
            tag: "procharacters-push-test",
          },
        );
        if (result.ok) sent += 1;
        else if (result.gone) {
          gone += 1;
          await removePushSubscription(account.id, sub.endpoint);
        } else failed += 1;
      }
      if (sent > 0) bump("pushTestSent", sent);
      return {
        ok: sent > 0,
        configured: true,
        devices: subs.length,
        sent,
        failed,
        gone,
      };
    });
  };
};
