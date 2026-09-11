# Ops — Error alerts (no Discord required)

**Goal:** Get a ping on your **phone** (or email) when the API throws a real 5xx.

**Status chip:** Account → **System pulse** → `Alerts · ntfy` / `No error alerts`.

You do **not** need Discord or Slack.

---

## Recommended: ntfy (free phone push) — 3 minutes

[ntfy](https://ntfy.sh) is free. No account required for a private topic if the name is hard to guess.

### 1. Pick a secret topic name

Something long and random (treat like a password), e.g.:

```text
pcc-gary-ops-k7m2xq9w
```

**URL you will paste on Railway:**

```text
https://ntfy.sh/pcc-gary-ops-k7m2xq9w
```

(Use *your* secret, not this example if you paste it publicly.)

### 2. Phone

1. Install **ntfy** (iOS / Android) — or open https://ntfy.sh/app in a browser  
2. **Subscribe** to the same topic name (`pcc-gary-ops-k7m2xq9w`)  
3. Leave notifications on for that topic

### 3. Railway (API only)

1. Railway → **captivating-vision** → **`procharacters-api`** (not web)  
2. **Variables** → New  

| Name | Value |
|------|--------|
| `ERROR_WEBHOOK_URL` | `https://ntfy.sh/YOUR-SECRET-TOPIC` |

3. Save → wait for redeploy  

### 4. Smoke

Account → System pulse → **Send test alert**  
→ phone should buzz with **Procharacters · test OK**.

Or:

```bash
curl -sS -X POST \
  https://procharacters-api-production-0417.up.railway.app/api/v1/ops/error-webhook/test
```

Health should show:

```json
"errorWebhook": true,
"errorWebhookUrl": true,
"alertChannel": "ntfy"
```

---

## Alternative: email (if Resend already works for magic links)

On **procharacters-api**:

| Name | Value |
|------|--------|
| `ERROR_ALERT_EMAIL` | `you@your-email.com` |
| `RESEND_API_KEY` | (already set if magic-link email works) |

Optional: keep ntfy **and** email — both fire.

---

## Discord / Slack (optional)

Only if you want them later:

- Discord channel webhook URL → same `ERROR_WEBHOOK_URL`  
- Slack Incoming Webhook URL → same var  

Not required.

---

## What pages you

Same channel, two kinds of page:

| Page | When | Looks like |
|------|------|------------|
| **5xx** | The API throws a real server error | `ALERT 500 GET /api/v1/… — <error>` |
| **BRAIN DOWN** | xAI rejects chat calls — every character has fallen back to soft error copy | `ALERT 403 LLM xai/chat — BRAIN DOWN: credits_or_spending_limit (HTTP 403), first failed turn. … top up / raise the limit in the xAI console.` |
| **BRAIN BACK** | The first successful chat call after a paged outage | `NOTICE 200 LLM xai/chat — BRAIN BACK: chat is answering again after 47m down …` (quiet priority) |

Brain pages are deliberately coarse — the reason and the action, never xAI's raw error text. Rules: dead key or no credits pages on the **first** failed turn; timeouts / rate limits / 5xx from xAI wait for **3 in a row**. While the outage continues you get one **STILL DOWN** page every 30 minutes, not one per turn. `GET /health` → `llm.pagedReason` shows what is currently paged (`null` when nothing is).

Regression guard: `cd backend && npm run test:llm-failure` boots the app against a fake xAI and a fake webhook and asserts all of the above.

---

## What this is *not*

| Stripe webhook | Error alerts |
|----------------|--------------|
| `STRIPE_WEBHOOK_SECRET` | **`ERROR_WEBHOOK_URL`** or **`ERROR_ALERT_EMAIL`** |
| Money in | You get paged on 5xx and on a dead brain |

Free chat never depends on alerts.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Still **No error alerts** | Var on **api** service? Typo? Wait for redeploy (`gitSha` moves) |
| Test `503` | Neither ntfy URL nor email path configured |
| Test `429` | Wait ~60s |
| ntfy silent | Same topic name on phone + Railway? Notifications allowed? |
| Email silent | `RESEND_API_KEY` live? Check spam; Resend domain verified? |

---

## Related

- [LIVE-STATUS.md](./LIVE-STATUS.md)  
- [DEPLOY.md](./DEPLOY.md)  
- [ops-billing-stripe.md](./ops-billing-stripe.md) — payments (different webhook)  

*Easiest path for Boss Sr.: ntfy topic → Railway var → Send test alert.*
