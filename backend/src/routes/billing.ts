import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getAccountPlanSummary,
  resolveAccountToken,
} from "../lib/accounts/account-store.js";
import {
  confirmCheckoutSession,
  createCheckoutSession,
  getBillingCatalog,
  handleStripeWebhook,
  isStripeConfigured,
  isStripeWebhookConfigured,
  stripeMode,
} from "../lib/billing/stripe-billing.js";
import { bump } from "../lib/observability/metrics.js";
import { bearerToken } from "./accounts.js";

const checkoutSchema = z.object({
  product: z.enum(["day_pass", "supporter"]).default("day_pass"),
});

const confirmSchema = z.object({
  sessionId: z.string().min(8).max(200),
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
        webhookConfigured: isStripeWebhookConfigured(),
        mode: stripeMode(),
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
        bump("checkoutStarts");
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
     * Return-page confirm — apply paid Checkout Session even if webhook is slow.
     * Idempotent with webhook (same session id cannot stack twice).
     */
    app.post("/billing/confirm", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      if (!isStripeConfigured()) {
        return reply.code(503).send({
          error: "Payments not configured yet — free path still works",
          code: "STRIPE_NOT_CONFIGURED",
        });
      }
      try {
        const body = confirmSchema.parse(request.body ?? {});
        const result = await confirmCheckoutSession({
          sessionId: body.sessionId,
          accountId: account.id,
        });
        if (!result.ok) {
          return reply.code(402).send({
            error: "Payment not completed yet",
            paymentStatus: result.paymentStatus,
          });
        }
        bump("checkoutConfirms");
        // Re-resolve after grant for fresh plan fields
        const refreshed = await resolveAccountToken(bearerToken(request));
        const summary = refreshed
          ? getAccountPlanSummary(refreshed)
          : getAccountPlanSummary(account);
        return {
          ok: true,
          grantedPlan: result.plan,
          ...summary,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        const message = error instanceof Error ? error.message : "Confirm failed";
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
