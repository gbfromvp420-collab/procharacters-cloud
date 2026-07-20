# Procharacters.cloud — Live status (Gary)

**Updated:** 2026-07-19 (**Studio Forge Revolution v3 Unchained**)  
**For:** quick “what’s real right now” — no code required.  
**Command:** King Grok CEO has **final say on development** (Gary = Boss Sr., 50/50). See [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md).

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
| Live NSFW chat (Grok) | ✅ |
| Gallery + character cards | ✅ |
| Accounts (Postgres) | ✅ `ACCOUNTS_PROVIDER=prisma` |
| Resume codes (multi-device) | ✅ |
| Edge Pace mode (phase strip) | ✅ |
| “What we remember” memory strip | ✅ scene lock chips + structured prior |
| Phase 5 anti-loop + restore rehydrate | ✅ `f4218eb` |
| Memory stickiness (2026-07-18 night) | ✅ scene lock every turn · sticky Remember default · resume dossier refresh |
| **Heat Arc continuity** | ✅ scene lock v2 (pose/act/name) · spark→locked pacing · tappable lock chips · mid-session vibe chips |
| **Edge Pace feel** | ✅ round-aware coach · strip Seed/Fire · phase chips · last-8s urgency · multi-cycle mind lines |
| **Return Intelligence** | ✅ last-scene dossier · named return greetings · **They remember you** card + pick-up seeds |
| **Heat Trail** | ✅ resume stamps depth/chips · gallery tiles + Continue + hero show where you left heat |
| **End Ritual** | ✅ pause banner + chat resume hero show full heat trail (depth/chips/recap) |
| **Error alerts (ntfy)** | ✅ Gary live · channel ntfy · test 200 |
| CharacterSession Prisma (durable memory) | ✅ migration `20260717_character_session` |
| Web Push (VAPID) + **Send test** | ✅ server configured |
| Phone push smoke (Gary) | ✅ confirmed 2026-07-18 |
| Send test **429 UX** (retry-after copy) | ✅ |
| Chat + gallery push strip | ✅ Enable / Send test / sign-in CTA |
| Gallery tile **Continue** primary | ✅ when resume exists (New chat secondary) |
| LiveKit avatar reactivity | ✅ sticky bands + crossfade + band pulse |
| Account **System pulse** | ✅ `/health` + `/metrics` — deploy, DB, push, Stripe, uptime, sessions, turns, WS, 5xx · **Send test alert** |
| **Error alerts (5xx)** | ✅ eng: **ntfy** (no Discord) · email · Discord/Slack · [ops-error-webhook.md](./ops-error-webhook.md) · Gary sets topic URL |
| Continue **Copy code** | ✅ one-tap resume code on gallery banner |
| PWA install / Home Screen | ✅ manifest + install tip + offline shell |
| Stripe Day Pass / Supporter UI | ✅ free path; **confirm-on-return** + webhook; **LIVE** keys; **one-tap** Day Pass/Supporter on Soft Support (chat + gallery) |
| Soft Day Pass after heat win | ✅ Session win toast offers Day Pass when signed-in + not premium (never blocks) |
| **Post-checkout unlock ceremony** | ✅ Account `#premium-unlocked` · Create / My models / hub · cap headroom |
| **Heat→pay no double-ask** | ✅ Session win owns Day Pass; Soft Support yields + 6h cooldown after win |
| **Return seed after End** | ✅ “We’ll hold this heat” + Enable alerts / Sign in when deep session |
| **My models** gallery filter | ✅ private My Characters merge for signed-in (`/?filter=owned`) |
| Create My Character deep-link | ✅ **`/models/studio`** create · **`/models/studio/edit/:id`** edit · `/chat?create=1` + `?edit=` redirect |
| **My Models Studio** | ✅ **Slim v2** foundation retained under advanced fields |
| **Studio Forge v3 Unchained** | ✅ Conversational fantasy → DNA (adaptive prompt + behavior tree + LiveKit meta + memory seeds) · canvas composer · sentiment clips · Export DNA · Server Action + `POST /characters/forge/expand` · save as `custom-v3` · [STUDIO-FORGE-V3.md](./STUDIO-FORGE-V3.md) |
| **DNA runtime (live chat)** | ✅ custom-v3: memory seeds → prior/session notes · DNA starter opening · presence from LiveKit meta · clip intensity map · evolution bias in session mode · richer adaptive prompt |
| **DNA behavior-tree stepper** | ✅ soft spark→tease→edge→deny/release mid-session · prompt + avatar floors · whisper strip DNA node · Seed/Fire chips |
| **DNA chip bar + Heat Trail** | ✅ 6-node path strip · one-tap Fire chips · climb flash · gallery/Continue/resume hero show DNA node |
| **DNA gallery badges** | ✅ gallery tiles + hero reel + End pause banner · DNA · node violet · return loop stamps node every turn |
| **DNA conversion close** | ✅ Session win “DNA heat locked” + Day Pass CTA · Soft Support forge headroom · Account My models DNA trail · offline shell DNA Continue |
| **Unlock → Forge + Edge×DNA** | ✅ Premium ceremony primary **Forge another model** · Edge Pace strip dual DNA path + merged chips |
| **Post-forge Edge + funnel metrics** | ✅ DNA win toast **Edge Pace · climb DNA** primary · `/metrics` forge→DNA→edge→climbs→checkout · System pulse funnel chips |
| **Sexy first open + pay funnel** | ✅ Studio starter auto-seeds chat composer on session_ready · Stripe webhook bumps checkoutConfirms · pulse conversion % ratios |
| **DNA climb motion + funnel UI** | ✅ `dna-climb-node` / shell animations on whisper + Edge×DNA · System pulse funnel dashboard strip |
| **DNA power reclaim** | ✅ Continue deep-link `mode=edge_pace` on DNA trails · resume API mode switch · tree node stamped on rehydrate · gallery **DNA power · Edge reclaim** |
| **Reclaim everywhere** | ✅ offline shell Edge reclaim · End pause DNA power CTA · Account My models DNA power · hero reel DNA power button |
| **Reclaim chrome + share** | ✅ SiteChrome DNA power · NetworkOfflineBanner · SessionDropRescue DNA rejoin · share URLs carry rehydrate + edge mode |
| **Reclaim card + print + account** | ✅ Character card DNA power · print/QR Edge reclaim · Account resume markdown DNA · chat idle hero DNA reclaim |
| **DNA power push + multi-device** | ✅ Expiry Web Push deep-links `mode=edge_pace` + rehydrate when DNA/Edge hot · copy “DNA power · Edge reclaim” · account session list exposes `dnaTreeNodeId`/`sessionMode` · resume cache multi-device stamp · emailed resume links reclaim · metric `pushDnaPowerReclaims` on System pulse |
| Premium Account payoff | ✅ use-the-headroom strip · free vs premium caps display fixed |
| Post-create My Character win | ✅ Start heat / Edge Pace toast · Mine tile badge · picker “My models” group |
| Edit My Character | ✅ Edit identity/vibe/phrases/scenes · Save changes · owner list fields · PATCH requires sign-in |
| Clip uploads (private) | ✅ owner Bearer required · batch + single · gallery Edit deep-link · Pack n/4 chips |
| Account **My models** hub | ✅ list · cap · Chat/Continue/Edit/**Duplicate**/Edge/Delete · `#my-models` |
| Duplicate My Character | ✅ clone identity/vibe/phrases/scenes (new private id · uses cap slot) |
| Private share guard | ✅ share card on mine → resume code (not public gallery link) |
| Create cap UX | ✅ using n/limit · almost-full / cap-full · Save disabled at cap |
| Pause after End (mine) | ✅ Edit model · My models CTAs on session paused banner |
| **SiteChrome** sticky nav | ✅ Gallery / Chat / Account / Models · Continue/Reclaim on every surface |
| Offline shell v2 | ✅ cached resumes · Continue/Reclaim · auto-reload on reconnect · PWA Models shortcut |
| Offline banner | ✅ Continue chip + resume count while wire is down |
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
6. Optional: **alerts without Discord** — `ERROR_WEBHOOK_URL=https://ntfy.sh/YOUR-SECRET-TOPIC` + free ntfy app → [ops-error-webhook.md](./ops-error-webhook.md) · **Send test alert**  
7. Optional: more footage packs when ready

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
