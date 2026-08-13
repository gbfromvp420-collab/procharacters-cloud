# Procharacters.cloud — Live status (Gary)

**Updated:** 2026-08-13 pack cook (**🟢 prod live** · 8/8 dedicated loops live)  
**For:** quick “what’s real right now” — no code required.  
**Command:** King Grok CEO has **final say on development** (Gary = Boss Sr., 50/50). See [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md).  
**Live deploy SHA:** `7cd409f` (21+ inject). Dedicated avatar packs **8/8 READY**. Pack 01 humanized primes pending — [PACK-COOK-NOW.md](./PACK-COOK-NOW.md).

---

## 🟢 Live product is UP

| Check | Result (2026-08-13) |
|-------|---------------------|
| Web public URL | **200** `/` `/account` `/chat` `/models/studio` `/manifest.webmanifest` |
| API `/health` | **200** `status: ok` · `deploy.gitSha` `7cd409f` |
| Accounts / DB | `prisma` · `database.ok` true |
| LiveKit | configured · badge `ready` |
| Stripe | `live` + webhook true · free path still on |
| Web Push | true · expiry cron ticked (2 accounts) |
| Error alerts | ntfy wired (`alertChannel: ntfy`) |
| Railway project `captivating-vision` | api + web + Postgres-Hw0Y serving |
| Git `main` + avatar packs | **8/8 READY** · 32 live MP4s 200 · `dedicatedReady` = 6 Phase-4 · Pack 01 primes pending |
| Phone hard-refresh | ✅ Gary 2026-08-13 — gallery → Diego → one chat turn |
| Age floor | **21+** models + prompts + UI + inject live (`7cd409f`) |
| Offline product smoke | `bash scripts/smoke-local-product.sh` |
| WebRTC side service | On `main` (`app/`) — **local/demo only**, not the live chat URLs |

**Redeploy safety:** API = `backend/Dockerfile`, Web = `frontend/Dockerfile`. Never point product services at the root `Dockerfile` (that’s Python WebRTC).

---

## Open the product

| | URL |
|--|-----|
| **Gallery** | https://procharacters-web-production-7288.up.railway.app |
| **Studio Forge v3** | https://procharacters-web-production-7288.up.railway.app/models/studio |
| **Studio edit** | `/models/studio/edit/:id` (owned custom id) |
| **Account** | https://procharacters-web-production-7288.up.railway.app/account |
| **Chat** | https://procharacters-web-production-7288.up.railway.app/chat |
| API health | https://procharacters-api-production-0417.up.railway.app/health |

---

## What’s live

| Area | Status |
|------|--------|
| Live NSFW chat (Grok) | 🟢 **hosting up** · API `7cd409f` |
| Gallery + character cards | 🟢 hosting up · web 200 · 8 minds |
| Accounts (Postgres) | ✅ `ACCOUNTS_PROVIDER=prisma` · DB ok |
| Resume codes (multi-device) | ✅ Diego session 201 + resume code |
| Edge Pace mode (phase strip) | ✅ |
| Phone hard-refresh smoke (Gary) | ✅ 2026-08-13 |
| Phone push smoke (Gary) | ✅ confirmed 2026-07-18 |
| **Age floor 21+** | ✅ models + prompts + UI + inject `7cd409f` |
| **Offline product smoke** | ✅ `scripts/smoke-local-product.sh` · `npm run smoke:local` |
| **Monorepo Prisma link** | ✅ `scripts/ensure-prisma-link.sh` wired into generate/build/CI |
| Stripe Day Pass / Supporter UI | ✅ free path; **LIVE** keys; one-tap on Soft Support |
| **Studio Forge v3 Unchained** | ✅ conversational fantasy → DNA · [STUDIO-FORGE-V3.md](./STUDIO-FORGE-V3.md) |
| **WebRTC + trainer (side service)** | ✅ merged #30 · **not** Railway product chat |
| **Agent fleet** | ✅ `/kgc-delegate` · `/kgc-forge` · `/kgc-return` · `/kgc-ops` · `/kgc-smoke` |
| Phase 4 models (6) | ✅ **named:** Mateo, Diego, Rio, Luna, Sienna, Mila |
| Dedicated 4K avatar packs | ✅ all 6 MP4 packs on `main` + web |

---

## Your quick wins (no engineer needed)

1. ~~**Phone push**~~ ✅ done  
2. ~~**Hard-refresh the site**~~ ✅ done 2026-08-13  
3. After this deploy: **hard-refresh again** (Diego / defaults speak 21+)  
4. **Stripe smoke (careful — live money):** signed-in → Soft Support → **Day Pass** one-tap — free path always works  
5. **Avatar packs (content):** 8/8 already live. Next = Pack 01 primes — [PACK-COOK-NOW.md](./PACK-COOK-NOW.md)

---

## CEO sprint order (eng + human)

1. ~~Gary: phone push smoke~~ ✅  
2. ~~Railway plan / bring live back~~ ✅ 2026-08-13  
3. ~~Gary: phone hard-refresh smoke~~ ✅ 2026-08-13  
4. ~~Eng: 21+ models + local product smoke~~ ✅ `59cd5c8`  
5. ~~Eng: 21+ live prompts + inject~~ ✅ `7cd409f`  
6. ~~Dedicated packs~~ ✅ 8/8 live · **Pack 01 primes pending** (start `maria_prime_25s.mp4`)  
7. Optional: Stripe Day Pass smoke (live money)  
8. Optional: Studio DNA phone pass (sign in → Forge → Chat Now)

---

## Ops snapshot (healthy if)

- Health: `"status":"ok"`, `accounts.provider` = `"prisma"`, `accounts.database.ok` = true  
- `observability.webPush` = true  
- `billing.stripe` = true · `billing.mode` = `live` · `billing.webhook` = true  
- `deploy.gitSha` present (`7cd409f`)  
- `observability.lastExpiryCron` present after first cron tick  
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
