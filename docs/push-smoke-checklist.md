# Web Push smoke checklist (Phase 1)

**Goal:** Prove resume-expiry push works on a real phone without guessing.

**Prod API:** `https://procharacters-api-production-0417.up.railway.app`  
**Prod Web:** `https://procharacters-web-production-7288.up.railway.app`

---

## 1. Server keys (30 seconds)

```powershell
Invoke-RestMethod https://procharacters-api-production-0417.up.railway.app/api/v1/push/vapid-public-key
```

Expect:

```json
{ "configured": true, "publicKey": "B… long key …" }
```

If `configured: false` → set on Railway `procharacters-api`:

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`)
- `VAPID_SUBJECT=mailto:ops@procharacters.cloud`
- `PUSH_SUBSCRIPTIONS_PATH=/data/push-subscriptions.json`

---

## 2. Local / script smoke

From repo:

```powershell
cd backend
npx tsx scripts/smoke-push-vapid.ts
# or against prod:
npx tsx scripts/smoke-push-vapid.ts https://procharacters-api-production-0417.up.railway.app
```

Expect exit 0 and `configured: true`.

---

## 3. Phone / browser (5 minutes)

1. Open prod web on **Chrome Android** or **Safari iOS**.  
   - Prefer **Add to Home Screen / Install app** (Account page shows a hint).  
   - iOS 16.4+: open from the home icon for reliable push.  
   - Manifest: `https://…/manifest.webmanifest`
2. Sign in (**Account**).
3. In **Web Push · resume expiry** panel:
   - Tap **Enable push** → Allow notifications.
   - Chip should read **This browser on**.
4. Tap **Send test** — you should get a system notification within a few seconds.
5. Tap the test notification → opens **Account**.
6. Optional: **Check expiry** forces a resume-code expiry scan (`force=true`).  
   Real alerts fire when a code is within 3 days (hourly cron also runs).
7. Real expiry notification opens **the soonest-expiring chat**
   (`/chat?resume=CODE&character=…`) when a code exists — otherwise Account.

### API test (optional)

```http
POST /api/v1/accounts/me/push/test
Authorization: Bearer <token>
Content-Type: application/json
{}
```

---

## 4. Failures to check

| Symptom | Likely fix |
|---------|------------|
| Enable push: not configured | VAPID vars missing / API not redeployed |
| Permission denied | Browser settings → site notifications |
| Subscribed but never notified | No codes in 3-day window; cron off; cooldown 12h |
| 410 gone endpoints | Re-enable push (stale sub cleaned automatically) |
| Send test → 429 | Rate limited (default 6 / 15 min per account) — wait and retry |
| Offline page shows | Expected when network is down after SW install (PWA shell) |

---

## 5. Cron env (optional overrides)

| Variable | Default | Meaning |
|----------|---------|---------|
| `RESUME_EXPIRY_PUSH_DAYS` | `3` | Warn window |
| `RESUME_EXPIRY_PUSH_COOLDOWN_MS` | `43200000` (12h) | Per-subscription min gap |
| `RESUME_EXPIRY_PUSH_CRON_MS` | `3600000` (1h) | Background scan interval; `0` = off |

---

*Part of [v2.2-roadmap.md](./v2.2-roadmap.md) Phase 1.*
