import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getAccountPlanSummary,
  resolveAccountToken,
} from "../lib/accounts/account-store.js";
import {
  createCheckoutSession,
  getBillingCatalog,
  handleStripeWebhook,
  isStripeConfigured,
} from "../lib/billing/stripe-billing.js";
import { bump } from "../lib/observability/metrics.js";
import { bearerToken } from "./accounts.js";

const checkoutSchema = z.object({
  product: z.enum(["day_pass", "supporter"]).default("day_pass"),
});

export const createBillingRoutes = (): FastifyPluginAsync => {
  return async (app) => {
    /** Public catalog — free path always listed; checkout needs Stripe keys. */
    app.get("/billing/catalog", async () => getBillingCatalog());

    app.get("/billing/status", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const plan = getAccountPlanSummary(account);
      return {
        configured: isStripeConfigured(),
        ...plan,
        freePath: true,
        benefits: {
          free: {
            customsLimit: Number(process.env.CUSTOM_CHARS_PER_ACCOUNT ?? 10),
            label: "Full chat + gallery · free forever",
          },
          premium: {
            customsLimit: Number(process.env.CUSTOM_CHARS_PER_ACCOUNT_PREMIUM ?? 40),
            label: "More My Characters + higher upload headroom",
          },
        },
      };
    });

    app.post("/billing/checkout", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Sign in to upgrade" });
      }
      if (!isStripeConfigured()) {
        return reply.code(503).send({
          error: "Payments not configured yet — free path still works",
          code: "STRIPE_NOT_CONFIGURED",
        });
      }
      try {
        const body = checkoutSchema.parse(request.body ?? {});
        const session = await createCheckoutSession({
          accountId: account.id,
          handle: account.handle,
          product: body.product,
          email: account.email,
        });
        bump("httpRequests"); // already counted by hook
        return { url: session.url, sessionId: session.sessionId };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        const message = error instanceof Error ? error.message : "Checkout failed";
        return reply.code(400).send({ error: message });
      }
    });

    /**
     * Stripe webhook — expects raw body available as request.rawBody (set in app.ts).
     */
    app.post("/billing/webhook", async (request, reply) => {
      try {
        const sig = request.headers["stripe-signature"];
        const signature = Array.isArray(sig) ? sig[0] : sig;
        const raw =
          (request as { rawBody?: Buffer }).rawBody ??
          Buffer.from(JSON.stringify(request.body ?? {}));
        const result = await handleStripeWebhook(raw, signature);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Webhook error";
        request.log.warn({ err: message }, "stripe_webhook_failed");
        return reply.code(400).send({ error: message });
      }
    });
  };
};
