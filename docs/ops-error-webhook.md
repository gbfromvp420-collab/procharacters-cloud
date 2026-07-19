# Ops — Error webhook (5xx alerts)

**Goal:** Get a Slack or Discord ping when the API throws a real 5xx — so you sleep at night.

**Status chip:** Account → **System pulse** → `Alerts on` / `No error webhook`.

---

## What it is (not Stripe)

| | Stripe webhook | Error webhook |
|--|----------------|---------------|
| Env var | `STRIPE_WEBHOOK_SECRET` | **`ERROR_WEBHOOK_URL`** |
| Purpose | Confirm Day Pass payments | Alert you on server 5xx |
| Direction | Stripe → our API | Our API → Slack/Discord |

You already have Stripe live. This is a **separate** optional URL.

---

## Fix in 4 steps (Discord — easiest)

### 1. Create a Discord webhook

1. Open your ops server (or make one: **#procharacters-ops**)
2. Channel settings → **Integrations** → **Webhooks** → **New Webhook**
3. Name it `procharacters-api`
4. **Copy Webhook URL**  
   Looks like: `https://discord.com/api/webhooks/123…/abc…`

### 2. Paste on Railway (API only)

1. [Railway dashboard](https://railway.app) → project **captivating-vision**
2. Service **`procharacters-api`** (not the web frontend)
3. **Variables** → **New**
4. Name: `ERROR_WEBHOOK_URL`  
   Value: paste the Discord (or Slack) URL — **no quotes**
5. Save → wait for redeploy (or **Deploy** once)

### 3. Confirm health chip

After API redeploys:

```bash
curl -sS https://procharacters-api-production-0417.up.railway.app/health | jq .observability
```

You want:

```json
"errorWebhook": true,
"errorWebhookUrl": true
```

Or open **Account → System pulse** — chip should say **Alerts on**.

### 4. Send test ping

**From Account (after this ship):** System pulse → **Send test alert**

**Or curl:**

```bash
curl -sS -X POST \
  https://procharacters-api-production-0417.up.railway.app/api/v1/ops/error-webhook/test
```

You should see a green **TEST PING** in Discord/Slack within a few seconds.

Rate limit: **1 test per 60s** (process-wide) so the endpoint can’t spam your channel.

---

## Slack instead of Discord

1. Slack → your workspace → **Apps** → **Incoming Webhooks** → Add to channel
2. Copy the URL (`https://hooks.slack.com/services/…`)
3. Same Railway var: `ERROR_WEBHOOK_URL=<that url>`

Our payload sends both `text` (Slack) and `content` (Discord).

---

## What fires a real alert

| Event | Webhook? |
|-------|----------|
| Unhandled throw / 5xx error handler | ✅ |
| Silent `reply.code(500)` paths | ✅ |
| 4xx client errors (bad auth, validation) | ❌ (by design) |
| Health checks | ❌ |
| Manual **Send test alert** | ✅ (green TEST PING) |

No request bodies are sent (PII / NSFW safe). You get path, method, status, requestId, short stack, deploy SHA.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Chip still **No error webhook** | Var on **api** service? Typo in name? Wait for redeploy; check `gitSha` moved |
| Test returns `503` | `ERROR_WEBHOOK_URL` empty or whitespace |
| Test returns `429` | Wait ~60s and retry |
| Test returns `502` | URL wrong / webhook deleted / Discord rejects body — check API logs `error_webhook_failed` |
| Discord says invalid webhook | Regenerate URL; don’t add query junk; full URL including secret tail |
| Alerts never on real 5xx | Confirm test works first; then check Railway logs for `reported_error` |

---

## Optional: Railway CLI (from this machine)

If you’ve pasted `RAILWAY_API_TOKEN` in session:

```bash
export RAILWAY_TOKEN="$RAILWAY_API_TOKEN"
# Link / select procharacters-api, then:
railway variables set ERROR_WEBHOOK_URL='https://discord.com/api/webhooks/…'
```

Never commit the URL (it’s a secret).

---

## Related

- [LIVE-STATUS.md](./LIVE-STATUS.md) — chip truth  
- [DEPLOY.md](./DEPLOY.md) — full env table  
- [ops-billing-stripe.md](./ops-billing-stripe.md) — payments (different webhook)  
- [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md) — ops priority stack  

*Free chat never depends on this. Alerts are for you, not the product path.*
