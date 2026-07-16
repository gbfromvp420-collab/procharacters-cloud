# Procharacters.cloud — Live status (Gary)

**Updated:** 2026-07-16  
**For:** quick “what’s real right now” — no code required.

---

## Open the product

| | URL |
|--|-----|
| **Gallery** | https://procharacters-web-production-7288.up.railway.app |
| **Account** | https://procharacters-web-production-7288.up.railway.app/account |
| **Chat** | https://procharacters-web-production-7288.up.railway.app/chat |
| API health | https://procharacters-api-production-0417.up.railway.app/health |

---

## What’s live

| Area | Status |
|------|--------|
| Live NSFW chat (Grok) | ✅ |
| Gallery + character cards | ✅ |
| Accounts (Postgres) | ✅ `ACCOUNTS_PROVIDER=prisma` |
| Resume codes (multi-device) | ✅ |
| Edge Pace mode (phase strip) | ✅ |
| “What we remember” memory strip | ✅ |
| Web Push (VAPID) + **Send test** | ✅ server configured |
| PWA install / Home Screen | ✅ manifest + install tip |
| Stripe Day Pass / Supporter UI | ✅ free path; checkout waits for keys |
| Phase 4 models (6) | ✅ minds live; **interim** avatar footage |
| Dedicated 4K avatar packs | ⏳ drop MP4s when ready |

---

## Your quick wins (no engineer needed)

1. **Phone push:** Install app / Add to Home Screen → Account → Enable push → **Send test**  
2. **Sign in once** if asked (Postgres upgrade) — same handle/passphrase  
3. **Stripe (optional):** when you want money, follow [ops-billing-stripe.md](./ops-billing-stripe.md)  
4. **Avatar pack (optional):** drop 4 MP4s per [DROP_IN.md](../frontend/public/avatar/packs/DROP_IN.md)

---

## Ops snapshot (healthy if)

- Health: `"status":"ok"`, `accounts.provider` = `"prisma"`, `accounts.database.ok` = true  
- `observability.webPush` = true  
- `billing.stripe` = false until you add keys (expected)  
- Manifest: `/manifest.webmanifest` returns 200  

---

## Related docs

- [README-for-Gary.md](./README-for-Gary.md) — control panel  
- [v2.2-roadmap.md](./v2.2-roadmap.md) — phases  
- [push-smoke-checklist.md](./push-smoke-checklist.md)  
- [ops-billing-stripe.md](./ops-billing-stripe.md)  
- [ops-data-backup.md](./ops-data-backup.md)  

*King Grok CEO team keeps this honest. Ask for a refresh anytime.*
