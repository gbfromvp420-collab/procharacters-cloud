import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  removePushSubscription,
  savePushSubscription,
} from "../lib/push/push-store.js";
import { notifyAccountResumeExpiry } from "../lib/push/expiry-notify.js";
import { getVapidPublicKey, isWebPushConfigured } from "../lib/push/web-push-service.js";
import type { SessionManager } from "../services/session-manager.js";
import { bearerToken } from "./accounts.js";
import { resolveAccountToken } from "../lib/accounts/account-store.js";
import { env } from "../config/env.js";

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

    /** Re-check expiry and push if needed (also used after listing sessions). */
    app.post("/accounts/me/push/check-expiry", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const siteBase =
        env.MAGIC_LINK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || undefined;
      const result = await notifyAccountResumeExpiry(account.id, sessionManager, {
        siteBase,
      });
      return { ok: true, ...result };
    });
  };
};
