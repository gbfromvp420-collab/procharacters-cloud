# Procharacters.cloud — Live status (Gary)

**Updated:** 2026-09-13 · Stage 1 close-out — see [STAGE-1.md](./STAGE-1.md)  
**For:** quick “what’s real right now” — no code required.  

> **Read [PHASE1-STATUS-AUDIT.md](./PHASE1-STATUS-AUDIT.md) and [STAGE-1.md](./STAGE-1.md) first.**
> Infra is up (probed 2026-09-13). Hard 21+ gate shipped in #103. Catalog is
> 50/50 deep. Chat needs a **live turn** after each cold start to prove xAI
> credits — `/health.llm.ok` can be true with `lastSuccessAt: null` right after
> boot. If turns fail with `credits_or_spending_limit`, only Gary can top up.

**Command:** King Grok CEO has **final say on development** (Gary = Boss Sr., 50/50). See [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md).  
**Live deploy SHA:** see `/health` `deploy.gitSha`. Pack 01 / 02 / 03 IDs stay.

---

## 🟡 Infrastructure is UP · chat needs a live-turn proof after cold start

| Check | Result (2026-09-13 unless noted) |
|-------|---------------------|
| **Chat replies** | ⚠ last measured outage 2026-09-10 (0/12). 2026-09-13 `/health.llm` = ok, configured, 0 failures, `lastSuccessAt` null (cold start). Owner: one real turn, or top up if it fails. |
| Web public URL | **200** `/` `/account` `/chat` `/models/studio` `/manifest.webmanifest` |
| API `/health` | **200** `status: ok` |
| Accounts / DB | `prisma` · `database.ok` true |
| LiveKit | configured · badge `ready` |
| Stripe | `live` + webhook true · **free path still on** |
| Web Push | true · **Send test reclaim shipping** (tap opens last chat / DNA, not Account) |
| Error alerts | ntfy wired |
| Railway `captivating-vision` | api + web + Postgres-Hw0Y |
| Pack 01 | **8/8 READY** · Mila Luna Sienna Diego Mateo Rio + defaults · **your clips** |
| Pack 02 | **13 named minds** · **52/52 clips 200** · **phone-passed** |
| Pack 03 | **29 unique first-name ids** · **116/116 clips 200** · Candy held (same file as Aria) |
| Gallery lanes | **Pack 01 / 02 / 03 chips** · `?filter=pack03` |
| Public floor | **50 named minds** · Prod* / VolumeCheck smoke cards **off the floor** |
| Studio DNA | ✅ phone-passed Forge → Save · Chat Now |
| Age floor | ✅ hard 21+ interstitial (#103) · 30-day `pc_age_verified_21` · client attestation, not ID check |
| Resume / Continue | ✅ create 201 · resume-code 200 · resumed session restored full history |

**Redeploy safety:** API = `backend/Dockerfile`, Web = `frontend/Dockerfile`. Never the root `Dockerfile` (Python WebRTC).

---

## Open the product

| | URL |
|--|-----|
| **Gallery** | https://procharacters-web-production-7288.up.railway.app |
| **Studio Forge v3** | https://procharacters-web-production-7288.up.railway.app/models/studio |
| **Account** | https://procharacters-web-production-7288.up.railway.app/account |
| **Chat** | https://procharacters-web-production-7288.up.railway.app/chat |
| API health | https://procharacters-api-production-0417.up.railway.app/health |

---

## Pack 02 names (first-name ids)

| Girls | Boys |
|-------|------|
| Jenny · Sarah · Jessica · Rachel · Samantha · Becca | Peter · Gary · Justin · Mark · Blake · Tommy · Kenny |

Featured Pack 02: **Jenny, Sarah, Peter, Justin**. Pack 01 IDs stay.

## Pack 03 names (first-name ids)

| Girls | Boys |
|-------|------|
| Emma · Olivia · Ava · Sophia · Isabella · Mia · Charlotte · Amelia · Harper · Evelyn · Avery · Scarlett · Zoey · Aria | Liam · Noah · Ethan · Mason · Lucas · Logan · Aiden · Jackson · Jacob · Jayden · Elijah · Carter · Wyatt · Hunter · Alex |

Featured Pack 03: **Liam, Noah, Emma, Olivia**. **Candy held** — same Drive file as Aria.

---

## What’s live

| Area | Status |
|------|--------|
| Live NSFW chat | ⚠ **prove after cold start** — 2026-09-10 was 0/12 credits. 2026-09-13 llm.ok true, lastSuccessAt null. Gary: one turn; top up at console.x.ai if it fails |
| Gallery · Pack 01 + Pack 02 + Pack 03 names | 🟢 **50 minds** · pack chips |
| Pack 03 dedicated loops | 🟢 **116/116 200** · catalog browsed |
| Pack 01 last-build clips | 🟢 phone-passed |
| Pack 02 dedicated loops | 🟢 **phone-passed** · 13/13 on site |
| Pack 02 / 03 mind copy | 🟢 fingerprints `#64` |
| Same-night reclaim | 🟢 gallery Chat autostart resumes heat |
| Studio Forge | 🟢 phone-passed (blocked by chat outage) |
| 21+ | ✅ hard gate (#103) · leftover 18+ chrome still rewritten · HTML without JS is still visible (attestation, not verification) |
| Resume codes | 🟢 |
| Stripe Day Pass UI | ✅ live keys · **not phone-smoked** (your card) |

---

## Your move (only if you want)

1. Chat someone, leave, tap their gallery **Chat** again — should pick up, not start over  
2. After deploy: **Enable alerts → Send test → tap the shade** — should open that chat, not Account  
3. **Candy** — unique Drive link (Aria’s file is already used)  
4. **Stripe smoke** — signed-in → Soft Support → Day Pass

I will **not** invent MP4s or charge your card.

---

*King Grok CEO · keep this honest.*
