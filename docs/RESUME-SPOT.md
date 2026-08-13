# Resume spot (if disconnected)

**Updated:** 2026-08-13 next ship (**🟢 prod live** · phone smoke ✅ · 21+ age floor + local product smoke landing)  
**Session:** King Grok CEO · hosting back · phone pass done · ship the interrupted offline pack onto live

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
| **Live API SHA** | `554c484` (docs unlock commit; product images Fastify + Next.js) |
| **This cook** | 21+ age floor across canon + `scripts/ensure-prisma-link.sh` + `scripts/smoke-local-product.sh` |
| **Boot** | API `startedAt` 2026-08-13T12:46:12Z |
| **Gary move** | ~~Phone hard-refresh~~ ✅ · next is optional Stripe Day Pass (live money) or `cook packs` |
| **Eng move** | Keep return loop + ops healthy. Say **`redeploy`** only for an extra rebuild. Dockerfile paths stay product-only |

**Redeploy safety:** API = `backend/Dockerfile`, Web = `frontend/Dockerfile`. Never root `Dockerfile` (Python WebRTC).

---

## Where we are

| Track | Status | Next human move |
|-------|--------|-----------------|
| **🟢 Railway / live** | **LIVE** · plan active · API `554c484` · prisma/LiveKit/Stripe/ntfy/push ok | Optional Stripe Day Pass smoke (live money) |
| **Phone hard-refresh** | ✅ Gary 2026-08-13 — gallery → Diego → one chat turn | — |
| **21+ age floor** | ✅ models, prompts, forge/custom copy, UI footers | Hard-refresh after this deploy to see new copy |
| **Offline product smoke** | ✅ `bash scripts/smoke-local-product.sh` · CI backend uses it | Run locally anytime Railway is dark |
| **WebRTC side service** | ✅ merged #30 · root `app/` + CI · compose profile `webrtc` | Local: `docker compose --profile webrtc up --build webrtc` — not prod chat |
| **Monorepo dual-stack** | ✅ README / DEPLOY / WEBRTC-ENGINE / compose | Keep Railway Dockerfile paths product-only |
| **Studio Forge v3** | ✅ code shipped (DNA + canvas + export) | Sign in → Studio → fantasy → **Forge model** → **Save · Chat Now** |
| **Return loop** | ✅ session create 201 · resume codes issue · Continue when a resume exists | Heat → End → gallery trail |
| **Pack pipeline** | ✅ Stage1 extract · Stage2 cut-loops v2 · batch | Finish primes → batch → `packs ready: <id>` |
| **Next** | **1) optional Stripe smoke · 2) cook packs · 3) Studio DNA phone pass** | say `cook packs` or `stripe` |

---

## Studio routes (canonical)

| Path | Purpose |
|------|---------|
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
