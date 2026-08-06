# Resume spot (if disconnected)

**Updated:** 2026-08-06 cold continue (**🔴 Railway trial expired · prod offline** · WebRTC side service on `main`)  
**Session:** King Grok CEO · post-#30 monorepo dual-stack hygiene · ops first when plan unlocks

### Agent fleet (slash / auto)

| Skill | Lane |
|-------|------|
| `/kgc-delegate` | Orchestrator · rehydrate · priority |
| `/kgc-forge` | Studio DNA · heat→forge |
| `/kgc-return` | DNA power reclaim · trail · dossier |
| `/kgc-ops` | health · metrics · ntfy · doc truth |
| `/kgc-smoke` | Gary phone checklists · `docs/smoke-fleet-checklist.md` |

---

## 🔴 BLOCKER — bring live back (do this first)

| Fact | Detail |
|------|--------|
| **Symptom** | API + Web public URLs → `404 Application not found` |
| **Cause** | Railway **trial expired** — redeploy mutations return: *“Your trial has expired. Please select a plan to continue using Railway.”* |
| **Project still exists** | `captivating-vision` · services: `procharacters-api`, `procharacters-web`, `Postgres-Hw0Y` |
| **Domains still registered** | `procharacters-api-production-0417.up.railway.app` · `procharacters-web-production-7288.up.railway.app` |
| **Deployments** | All recent deploys `REMOVED` (last good ship was 2026-07-20 ~`f430fc8` / docs note) |
| **Repo / packs** | ✅ `main` · WebRTC engine merged (#30) · dual-stack compose documented · **8 avatar packs READY** |
| **Gary move** | Railway dashboard → **pick a plan / add billing** on project `captivating-vision` → say **`redeploy`** (or I trigger redeploy the moment trial unlocks) |
| **Eng move after plan** | Redeploy api+web from `main` with **`backend/Dockerfile`** + **`frontend/Dockerfile` only** (never root `Dockerfile`) → curl `/health` → phone hard-refresh → shy-boy + defaults smoke |

**Until plan is active, no public chat/gallery/Studio.** Code and packs are fine; hosting is the gate.

---

## Where we are

| Track | Status | Next human move |
|-------|--------|-----------------|
| **🔴 Railway / live** | **OFFLINE** — trial expired · project+domains intact · deploys REMOVED | **Select paid plan** → redeploy api+web |
| **WebRTC side service** | ✅ merged #30 · root `app/` + CI · compose profile `webrtc` | Local: `docker compose --profile webrtc up --build webrtc` — not prod chat |
| **Monorepo dual-stack** | ✅ README / DEPLOY / WEBRTC-ENGINE / compose clarify product vs side service | Keep Railway Dockerfile paths product-only |
| **Studio Forge v3** | ✅ code shipped (DNA + canvas + export) | After live: Sign in → Studio → fantasy → **Forge model** → **Save · Chat Now** |
| **Forge this heat** | ✅ code shipped | Deep chat → gallery **Forge this DNA** → Studio |
| **DNA climb toast** | ✅ code shipped | Climb Soft→Tease→Edge — toast once per node |
| **Sexy DNA atmosphere** | ✅ code shipped | Climb to Edge — room / chips track tree |
| **Sexy DNA avatar + rejoin** | ✅ code shipped | Climb → End → Continue DNA reclaim |
| **DNA chat bubbles** | ✅ code shipped | Climb Tease/Edge — transcript glows with node |
| **Continue forge + DNA typing** | ✅ code shipped | Hot trail home → forge without hunting gallery |
| **Pack pipeline** | ✅ Stage1 extract · Stage2 cut-loops v2 · batch · id-map.example | Finish primes → batch → `packs ready: <id>` |
| **GrokBuild 4K v1.0** | ✅ Humanized packs · Pack 01 roster · live-folder map | 6 primes → cut-loops → theme defs → `packs ready` |
| **Avatar clip refresh (EOD 07-20)** | ✅ shy-boy aroused fixed · 8 packs READY in git | After live: hard-refresh · smoke shy-boy + defaults |
| **DNA runtime / tree / trail / reclaim stack** | ✅ full eng stack on `main` | Smoke after redeploy |
| **Error alerts** | ✅ ntfy wired in code | Re-test after live |
| **Return loop** | ✅ full stack in code | Smoke heat → end → gallery trail after live |
| **EOD 2026-07-20** | ✅ STOP · push · save | Done — week gap; trial lapsed offline |
| **Next** | **1) Railway plan · 2) redeploy · 3) phone smoke · 4) primes/packs** | say `redeploy` after plan, or `cook packs` offline |

---

## Studio routes (canonical)

| Path | Purpose |
|------|---------|
| `/models/studio` | **Studio Forge v3** — conversational create |
| `/models/studio/edit/:id` | Edit owned model (+ DNA if present) |
| `/models/studio?edit=id` | Legacy → redirects to edit path |
| `/chat?create=1` | → Studio create |
| `/chat?edit=1&character=id` | → Studio edit path |

**Live (when hosting up):** https://procharacters-web-production-7288.up.railway.app/models/studio  

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
