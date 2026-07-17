# Procharacters.cloud — Live status (Gary)

**Updated:** 2026-07-17  
**For:** quick “what’s real right now” — no code required.  
**Command:** King Grok CEO has **final say on development** (Gary = Boss Sr., 50/50). See [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md).

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
| Phase 5 anti-loop + restore rehydrate | ✅ `f4218eb` |
| CharacterSession Prisma (durable memory) | ✅ migration `20260717_character_session` |
| Web Push (VAPID) + **Send test** | ✅ server configured |
| Send test **429 UX** (retry-after copy) | ✅ |
| Chat + gallery push strip | ✅ Enable / Send test / sign-in CTA |
| Gallery tile **Continue** primary | ✅ when resume exists (New chat secondary) |
| PWA install / Home Screen | ✅ manifest + install tip + offline shell |
| Stripe Day Pass / Supporter UI | ✅ free path; checkout waits for keys |
| Phase 4 models (6) | ✅ minds live; **interim** avatar footage |
| Dedicated 4K avatar packs | ⏳ drop MP4s when ready |

---

## Your quick wins (no engineer needed)

1. **Phone push (top priority):** Install app / Add to Home Screen → Account → Enable push → **Send test**  
2. **Sign in once** if asked (Postgres upgrade) — same handle/passphrase  
3. **Stripe (optional):** when you want money, follow [ops-billing-stripe.md](./ops-billing-stripe.md)  
4. **Avatar pack (optional):** drop 4 MP4s per [DROP_IN.md](../frontend/public/avatar/packs/DROP_IN.md)

---

## CEO sprint order (eng + human)

1. Gary: phone push smoke  
2. Eng: keep return loop + ops healthy (deploy fingerprint on `/health`)  
3. Content: dedicated packs when footage exists  
4. Optional: `ERROR_WEBHOOK_URL`, Stripe keys  

---

## Ops snapshot (healthy if)

- Health: `"status":"ok"`, `accounts.provider` = `"prisma"`, `accounts.database.ok` = true  
- `observability.webPush` = true  
- `billing.stripe` = false until you add keys (expected)  
- `deploy.gitSha` present after API redeploy (Railway commit)  
- `observability.lastExpiryCron` present after first cron tick (or null until then)  
- Manifest: `/manifest.webmanifest` returns 200  

---

## Related docs

- [TODAY-PHASE-LIST.md](./TODAY-PHASE-LIST.md) — today’s ships + remaining  
- [gg-continuity-lore.md](./gg-continuity-lore.md) — rehydrate first  
- [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md) — who decides what  
- [README-for-Gary.md](./README-for-Gary.md) — control panel  
- [v2.2-roadmap.md](./v2.2-roadmap.md) — phases  
- [push-smoke-checklist.md](./push-smoke-checklist.md)  
- [ops-billing-stripe.md](./ops-billing-stripe.md)  
- [ops-data-backup.md](./ops-data-backup.md)  

*King Grok CEO team keeps this honest. Ask for a refresh anytime.*
