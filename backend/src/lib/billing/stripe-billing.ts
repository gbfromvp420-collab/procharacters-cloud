/**
 * Phase 9 — Stripe Checkout lite (day pass / supporter).
 * Free path always works when Stripe is not configured.
 */
import Stripe from "stripe";
import { grantAccountPlan } from "../accounts/account-store.js";
import { bump } from "../observability/metrics.js";

export type CheckoutProduct = "day_pass" | "supporter";

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.trim();
}

export function isStripeWebhookConfigured(): boolean {
  return !!process.env.STRIPE_WEBHOOK_SECRET?.trim();
}

/** test | live | off — derived from secret key prefix (never logs the key). */
export function stripeMode(): "test" | "live" | "off" {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return "off";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  // Restricted keys / other formats — treat as configured unknown; prefer test label
  return key.includes("live") ? "live" : "test";
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY)");
  }
  return new Stripe(key);
}

function siteBase(): string {
  return (
    process.env.MAGIC_LINK_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://procharacters-web-production-7288.up.railway.app"
  );
}

function dayPassAmountCents(): number {
  return Number(process.env.STRIPE_DAY_PASS_CENTS ?? 499);
}

function supporterAmountCents(): number {
  return Number(process.env.STRIPE_SUPPORTER_CENTS ?? 999);
}

export function getBillingCatalog(): {
  configured: boolean;
  webhookConfigured: boolean;
  mode: "test" | "live" | "off";
  products: Array<{
    id: CheckoutProduct;
    name: string;
    description: string;
    amountCents: number;
    currency: string;
  }>;
} {
  return {
    configured: isStripeConfigured(),
    webhookConfigured: isStripeWebhookConfigured(),
    mode: stripeMode(),
    products: [
      {
        id: "day_pass",
        name: "Day Pass",
        description: "24h premium — more My Characters, higher upload limits",
        amountCents: dayPassAmountCents(),
        currency: "usd",
      },
      {
        id: "supporter",
        name: "Supporter",
        description: "30 days premium — same perks, longer runway",
        amountCents: supporterAmountCents(),
        currency: "usd",
      },
    ],
  };
}

export async function createCheckoutSession(options: {
  accountId: string;
  handle: string;
  product: CheckoutProduct;
  email?: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = stripeClient();
  const product = options.product === "supporter" ? "supporter" : "day_pass";
  const amount = product === "supporter" ? supporterAmountCents() : dayPassAmountCents();
  const name = product === "supporter" ? "Procharacters Supporter" : "Procharacters Day Pass";
  const description = product === "supporter" ? "30-day premium access" : "24-hour premium access";

  const base = siteBase();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: options.email || undefined,
    client_reference_id: options.accountId,
    metadata: {
      accountId: options.accountId,
      handle: options.handle,
      product,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: {
            name,
            description,
          },
        },
      },
    ],
    success_url: `${base}/account?billing=success&session_id={CHECKOUT_SESSION_ID}#premium-unlocked`,
    cancel_url: `${base}/account?billing=cancel`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return { url: session.url, sessionId: session.id };
}

export async function handleStripeWebhook(
  rawBody: Buffer | string,
  signature: string | undefined,
): Promise<{ received: true; type?: string }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  }
  if (!signature) {
    throw new Error("Missing stripe-signature header");
  }

  const stripe = stripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const accountId = session.metadata?.accountId || session.client_reference_id || "";
    const product = (session.metadata?.product || "day_pass") as CheckoutProduct;
    if (accountId && session.payment_status === "paid") {
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const grant = await grantAccountPlan(
        accountId,
        product === "supporter" ? "supporter" : "day_pass",
        {
          stripeCustomerId: customerId,
          checkoutSessionId: session.id,
        },
      );
      // Funnel: webhook path (return confirm also bumps — idempotent grants still count once each path)
      if (grant) {
        bump("checkoutConfirms");
      }
    }
  }

  return { received: true, type: event.type };
}

/**
 * Client return-page confirm — grants plan from a paid Checkout Session even if
 * the webhook is delayed/misconfigured. Idempotent with webhook via session id.
 */
export async function confirmCheckoutSession(options: {
  sessionId: string;
  accountId: string;
}): Promise<{
  ok: boolean;
  plan?: "day_pass" | "supporter";
  alreadyApplied?: boolean;
  paymentStatus?: string;
}> {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(options.sessionId);

  const sessionAccountId = session.metadata?.accountId || session.client_reference_id || "";
  if (!sessionAccountId || sessionAccountId !== options.accountId) {
    throw new Error("Checkout session does not belong to this account");
  }

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return {
      ok: false,
      paymentStatus: session.payment_status ?? session.status ?? "unpaid",
    };
  }

  const product = (session.metadata?.product || "day_pass") as CheckoutProduct;
  const plan = product === "supporter" ? "supporter" : "day_pass";
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  await grantAccountPlan(options.accountId, plan, {
    stripeCustomerId: customerId,
    checkoutSessionId: session.id,
  });

  return {
    ok: true,
    plan,
    paymentStatus: session.payment_status ?? "paid",
  };
}
