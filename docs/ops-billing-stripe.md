# Ops — Stripe payments lite (Phase 9)

## Free path

Chat, gallery, resumes, and My Characters (up to free cap) work **without** Stripe.
The Account UI always shows Day Pass / Supporter prices from `GET /api/v1/billing/catalog`;
checkout buttons enable only when `STRIPE_SECRET_KEY` is set.

## Enable Checkout (Railway) — Gary checklist

**You do not need to change app code.** Keys go on Railway only. Free chat keeps working if keys are missing.

1. Stripe Dashboard → [API keys](https://dashboard.stripe.com/apikeys)  
   - Start with **test** (`sk_test_…`) so you can pay with `4242…`  
   - Switch to **live** (`sk_live_…`) only when ready for real money  
2. Railway → project → service **`procharacters-api`** → **Variables** → add:

```
STRIPE_SECRET_KEY=sk_test_...          # or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # from step 3
MAGIC_LINK_BASE_URL=https://procharacters-web-production-7288.up.railway.app
# optional price overrides (cents)
# STRIPE_DAY_PASS_CENTS=499
# STRIPE_SUPPORTER_CENTS=999
# STRIPE_DAY_PASS_DAYS=1
# STRIPE_SUPPORTER_DAYS=30
```

3. Stripe → Developers → Webhooks (or Workbench → Webhooks) → **Add endpoint**:

```
https://procharacters-api-production-0417.up.railway.app/api/v1/billing/webhook
```

- Events: **`checkout.session.completed`** only (v1)  
- Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`  
- Endpoint must hit the **API** service (not the Next.js web)

4. Redeploy **procharacters-api** (Railway redeploys when vars change if configured; otherwise manual Redeploy).

5. Confirm:

```bash
curl -sS https://procharacters-api-production-0417.up.railway.app/api/v1/billing/catalog
# "configured": true, "mode": "test" (or "live")
curl -sS https://procharacters-api-production-0417.up.railway.app/health
# billing.stripe: true, billing.webhook: true, billing.mode: "test"|"live"
```

6. UI: Account → **Checkout ready** (or System pulse: **Stripe test/live** + **Pay webhook on**) → Day Pass / Supporter buttons unlock.

### Safety net (eng)

After checkout, Account also calls **`POST /api/v1/billing/confirm`** with `session_id` so premium applies even if the webhook is a second late. Webhook + confirm are **idempotent** on the same session (no double stack).

## Products (no Price IDs required)

Checkout uses dynamic `price_data`:

| Product | Env amount | Default | Entitlement |
|---------|------------|---------|-------------|
| Day Pass | `STRIPE_DAY_PASS_CENTS` | 499 ($4.99) | ~1 day premium (stackable) |
| Supporter | `STRIPE_SUPPORTER_CENTS` | 999 ($9.99) | ~30 days premium |

## Premium perks

- My Characters cap: free **10** → premium **40** (`CUSTOM_CHARS_PER_ACCOUNT*`)  
- Clip upload rate limits ~2.5×  

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/billing/catalog` | no |
| GET | `/api/v1/billing/status` | yes |
| POST | `/api/v1/billing/checkout` | yes `{ product: "day_pass" \| "supporter" }` |
| POST | `/api/v1/billing/confirm` | yes `{ sessionId }` — return-page grant |
| POST | `/api/v1/billing/webhook` | Stripe signature |

## UI

Account page → **Support / Day Pass** when signed in.

- Success return: `/account?billing=success` (polls plan for a few seconds)  
- Cancel: `/account?billing=cancel`

## Test card (Stripe test mode)

Use Stripe’s [test cards](https://stripe.com/docs/testing) e.g. `4242 4242 4242 4242`.

## Rollback

Unset `STRIPE_SECRET_KEY` → redeploy API. Free path unchanged; buttons show **Not live yet**.

## Notes

- Plans are stored on the **Prisma** account when `ACCOUNTS_PROVIDER=prisma` (phase 2.5 dual-write).  
- Free chat is never gated by Stripe.
