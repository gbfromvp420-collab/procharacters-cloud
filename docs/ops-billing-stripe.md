# Ops — Stripe payments lite (Phase 9)

## Free path

Chat, gallery, resumes, and My Characters (up to free cap) work **without** Stripe.

## Enable Checkout

1. Create a Stripe account → Developers → API keys → **Secret key**  
2. Railway `procharacters-api` variables:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
MAGIC_LINK_BASE_URL=https://procharacters-web-production-7288.up.railway.app
```

3. Stripe Dashboard → Developers → Webhooks → Add endpoint:

```
https://procharacters-api-production-0417.up.railway.app/api/v1/billing/webhook
```

Events: `checkout.session.completed`  
Copy signing secret → `STRIPE_WEBHOOK_SECRET`

4. Redeploy API.

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
| POST | `/api/v1/billing/webhook` | Stripe signature |

## UI

Account page → **Support / Day Pass** when signed in.

Success return: `/account?billing=success`  
Cancel: `/account?billing=cancel`
