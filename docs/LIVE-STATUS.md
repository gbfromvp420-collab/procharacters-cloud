# Procharacters.cloud — Live status (Gary)

**Updated:** 2026-07-19 (**cook** — shared SiteChrome return nav)  
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
| “What we remember” memory strip | ✅ scene lock chips + structured prior |
| Phase 5 anti-loop + restore rehydrate | ✅ `f4218eb` |
| Memory stickiness (2026-07-18 night) | ✅ scene lock every turn · sticky Remember default · resume dossier refresh |
| CharacterSession Prisma (durable memory) | ✅ migration `20260717_character_session` |
| Web Push (VAPID) + **Send test** | ✅ server configured |
| Phone push smoke (Gary) | ✅ confirmed 2026-07-18 |
| Send test **429 UX** (retry-after copy) | ✅ |
| Chat + gallery push strip | ✅ Enable / Send test / sign-in CTA |
| Gallery tile **Continue** primary | ✅ when resume exists (New chat secondary) |
| LiveKit avatar reactivity | ✅ sticky bands + crossfade + band pulse |
| Account **System pulse** | ✅ live `/health` chips (deploy SHA, push, DB, Stripe, webhook) |
| Continue **Copy code** | ✅ one-tap resume code on gallery banner |
| PWA install / Home Screen | ✅ manifest + install tip + offline shell |
| Stripe Day Pass / Supporter UI | ✅ free path; **confirm-on-return** + webhook; **LIVE** keys; **one-tap** Day Pass/Supporter on Soft Support (chat + gallery) |
| Soft Day Pass after heat win | ✅ Session win toast offers Day Pass when signed-in + not premium (never blocks) |
| **My models** gallery filter | ✅ private My Characters merge for signed-in (`/?filter=owned`) |
| Create My Character deep-link | ✅ `/chat?create=1` opens form; Account premium CTAs |
| Premium Account payoff | ✅ use-the-headroom strip · free vs premium caps display fixed |
| Post-create My Character win | ✅ Start heat / Edge Pace toast · Mine tile badge · picker “My models” group |
| Edit My Character | ✅ Edit identity/vibe/phrases/scenes · Save changes · owner list fields · PATCH requires sign-in |
| Clip uploads (private) | ✅ owner Bearer required · batch + single · gallery Edit deep-link · Pack n/4 chips |
| Account **My models** hub | ✅ list · cap · Chat/Continue/Edit/Edge/**Delete** · `#my-models` |
| Create cap UX | ✅ using n/limit · almost-full / cap-full · Save disabled at cap |
| Pause after End (mine) | ✅ Edit model · My models CTAs on session paused banner |
| Phase 4 models (6) | ✅ minds live · **named:** Mateo, Diego, Rio, Luna, Sienna, Mila |
| Dedicated 4K avatar packs | ✅ all 6 MP4 packs on `main` + web; API badges via `status.json` |
| Gallery hero reel | ✅ cinematic crossfade · swipe · progress · resume CTAs · **tonight’s cast** day-seed · mind fingerprints on tiles/cards/chat |
| Chat continuity pack | ✅ night stack + morning conversion CTAs · first-live flash · win toast · Seed/Fire · room wash · Reclaim · Export/Share heat |

---

## Your quick wins (no engineer needed)

1. ~~**Phone push**~~ ✅ done  
2. **Sign in once** if asked (Postgres upgrade) — same handle/passphrase  
3. **Stripe smoke (careful — live money):** signed-in → Soft Support → **Day Pass** one-tap, or Account checkout — free path always works  

4. **Avatar packs (content):** cut your library into 4 loops — start with 6 featured models → [GARY-PACK-EDITING.md](./GARY-PACK-EDITING.md)

---

## CEO sprint order (eng + human)

1. ~~Gary: phone push smoke~~ ✅  
2. Eng: keep return loop + ops healthy (deploy fingerprint on `/health`)  
3. ~~Housekeeping: close stale PRs `#1` `#2` `#3` `#4` `#29`~~ ✅ + CI workflows on `main`  
4. ~~Ops noise: Azure workflow manual-only + Account System pulse~~ ✅  
5. Content: dedicated packs when footage exists  
6. Optional: `ERROR_WEBHOOK_URL`, Stripe keys  

---

## Ops snapshot (healthy if)

- Health: `"status":"ok"`, `accounts.provider` = `"prisma"`, `accounts.database.ok` = true  
- `observability.webPush` = true  
- `billing.stripe` = false until you add keys (expected); after keys: `billing.mode` test|live + `billing.webhook`  
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
