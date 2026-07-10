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

1. Open prod web on **Chrome Android** or **Safari iOS** (iOS 16.4+ PWA/home screen may be required for reliable push).
2. Sign in (Account).
3. Tap **Enable push** → Allow notifications.
4. Confirm UI says push is on / subscribed.
5. Optional force check (while signed in, from browser console on account page — or use Account after deploy if “Check now” exists):

   Server will also run a background scan when `RESUME_EXPIRY_PUSH_CRON_MS` is set (default 1 hour).

6. To force a test notification without waiting for real expiry:
   - Create a session with a resume code, or temporarily lower `RESUME_EXPIRY_PUSH_DAYS` on a staging env.
   - Or POST `/api/v1/accounts/me/push/check-expiry` with `Authorization: Bearer <token>` after ensuring a code is within the window.

7. Notification should open **Account** (or later Continue chat).

---

## 4. Failures to check

| Symptom | Likely fix |
|---------|------------|
| Enable push: not configured | VAPID vars missing / API not redeployed |
| Permission denied | Browser settings → site notifications |
| Subscribed but never notified | No codes in 3-day window; cron off; cooldown 12h |
| 410 gone endpoints | Re-enable push (stale sub cleaned automatically) |

---

## 5. Cron env (optional overrides)

| Variable | Default | Meaning |
|----------|---------|---------|
| `RESUME_EXPIRY_PUSH_DAYS` | `3` | Warn window |
| `RESUME_EXPIRY_PUSH_COOLDOWN_MS` | `43200000` (12h) | Per-subscription min gap |
| `RESUME_EXPIRY_PUSH_CRON_MS` | `3600000` (1h) | Background scan interval; `0` = off |

---

*Part of [v2.2-roadmap.md](./v2.2-roadmap.md) Phase 1.*
