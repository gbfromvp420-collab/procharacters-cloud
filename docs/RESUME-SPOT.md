# Resume spot (if disconnected)

**Updated:** 2026-08-13 Railway plan unlock (**🟢 prod live** · API `c9fd651` · web 200)  
**Session:** King Grok CEO · hosting back · phone smoke next

### Agent fleet (slash / auto)

| Skill | Lane |
|-------|------|
| `/kgc-delegate` | Orchestrator · rehydrate · priority |
| `/kgc-forge` | Studio DNA · heat→forge |
| `/kgc-return` | DNA power reclaim · trail · dossier |
| `/kgc-ops` | health · metrics · ntfy · doc truth |
| `/kgc-smoke` | Gary phone checklists · `docs/smoke-fleet-checklist.md` |

---

## 🟢 LIVE — plan unlocked, product serving

| Fact | Detail |
|------|--------|
| **Symptom (old)** | API + Web were `404 Application not found` while trial was expired |
| **Now** | Both public URLs **200**. API `/health` `status: ok` |
| **Project** | `captivating-vision` · `procharacters-api` · `procharacters-web` · `Postgres-Hw0Y` |
| **Domains** | `procharacters-api-production-0417.up.railway.app` · `procharacters-web-production-7288.up.railway.app` |
| **Live API SHA** | `c9fd651` (2026-07-20 EOD product ship — last good avatar-pack refresh) |
| **Git `main`** | `c77f155` — WebRTC #30 + dual-stack docs only. **Do not** point product services at root `Dockerfile` |
| **Boot** | API `startedAt` 2026-08-13T12:37:20Z |
| **Gary move** | Phone **hard-refresh** → gallery + shy-boy + a default → one chat turn |
| **Eng move** | Docs truth shipped. Say **`redeploy`** only if you want api+web rebuilt from latest `main` (still `backend/Dockerfile` + `frontend/Dockerfile`) |

**Redeploy safety:** API = `backend/Dockerfile`, Web = `frontend/Dockerfile`. Never root `Dockerfile` (Python WebRTC).

---

## Where we are

| Track | Status | Next human move |
|-------|--------|-----------------|
| **🟢 Railway / live** | **LIVE** · plan active · API `c9fd651` · prisma/LiveKit/Stripe/ntfy/push ok | Phone hard-refresh · shy-boy + defaults smoke |
| **WebRTC side service** | ✅ merged #30 · root `app/` + CI · compose profile `webrtc` | Local: `docker compose --profile webrtc up --build webrtc` — not prod chat |
| **Monorepo dual-stack** | ✅ README / DEPLOY / WEBRTC-ENGINE / compose clarify product vs side service | Keep Railway Dockerfile paths product-only |
| **Studio Forge v3** | ✅ code shipped (DNA + canvas + export) | Sign in → Studio → fantasy → **Forge model** → **Save · Chat Now** |
| **Forge this heat** | ✅ code shipped | Deep chat → gallery **Forge this DNA** → Studio |
| **DNA climb toast** | ✅ code shipped | Climb Soft→Tease→Edge — toast once per node |
| **Sexy DNA atmosphere** | ✅ code shipped | Climb to Edge — room / chips track tree |
| **Sexy DNA avatar + rejoin** | ✅ code shipped | Climb → End → Continue DNA reclaim |
| **DNA chat bubbles** | ✅ code shipped | Climb Tease/Edge — transcript glows with node |
| **Continue forge + DNA typing** | ✅ code shipped | Hot trail home → forge without hunting gallery |
| **Pack pipeline** | ✅ Stage1 extract · Stage2 cut-loops v2 · batch · id-map.example | Finish primes → batch → `packs ready: <id>` |
| **GrokBuild 4K v1.0** | ✅ Humanized packs · Pack 01 roster · live-folder map | 6 primes → cut-loops → theme defs → `packs ready` |
| **Avatar clip refresh (EOD 07-20)** | ✅ shy-boy aroused fixed · 8 packs READY in git | Hard-refresh · smoke shy-boy + defaults |
| **DNA runtime / tree / trail / reclaim stack** | ✅ full eng stack on `main` | Smoke on live |
| **Error alerts** | ✅ ntfy live on API (`alertChannel: ntfy`) | Optional: Account **Send test alert** |
| **Return loop** | ✅ full stack in code | Smoke heat → end → gallery trail |
| **EOD 2026-07-20** | ✅ STOP · push · save | Closed — trial gap over |
| **Next** | **1) phone smoke · 2) optional `redeploy` to latest main · 3) primes/packs** | say `smoke` after phone pass, or `cook packs` |

---

## Studio routes (canonical)

| Path | Purpose |
|-------|---------|
| `/models/studio` | **Studio Forge v3** — conversational create |
| `/models/studio/edit/:id` | Edit owned model (+ DNA if present) |
| `/models/studio?edit=id` | Legacy → redirects to edit path |
| `/chat?create=1` | → Studio create |
| `/chat?edit=1&character=id` | → Studio edit path |

**Live:** https://procharacters-web-production-7288.up.railway.app/models/studio  

**API:** `POST /api/v1/characters/forge/expand`

---

## Studio Forge v3 Unchained checklist (shipped eng)

1. Conversational primary input → LLM/heuristic expand  
2. Naughty Syntax DNA: adaptive prompt + branches + behavior tree + LiveKit meta + clip tags + memory seeds  
3. Persist DNA on custom create/update (`custom-v3`)  
4. Canvas avatar composer (intensity / band aura)  
5. Sentiment-aware clip band in editor  
6. Export DNA JSON  
7. Next.js Server Action + REST path  
8. Rate limit + `forgeExpands` metric  
9. Manual slim fields retained under “Tune fields”  
10. Live chat UI untouched  

Doc: `docs/STUDIO-FORGE-V3.md`

*King Grok · 50/50 · ship it unchained.*
