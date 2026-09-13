# Procharacters.cloud — Live status (Gary)

**Updated:** 2026-09-13 · code-side leave-dev gaps closed in this cook  
**For:** quick “what’s real right now” — no code required.

> **Read [PHASE1-STATUS-AUDIT.md](./PHASE1-STATUS-AUDIT.md) first** for the 2026-09-10
> measurement. This page is the current ops snapshot. Infrastructure can be up
> while chat is down — look at `/health` `llm` and `product`, not just `status`.

**Command:** King Grok CEO has **final say on development** (Gary = Boss Sr., 50/50). See [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md).  
**Live deploy SHA:** see `/health` `deploy.gitSha`.

---

## Diagnosis (leave-dev blockers)

| Blocker | Kind | Status |
|---------|------|--------|
| **xAI credits / spending limit** | **Human / billing** | Only Gary can top up at [console.x.ai](https://console.x.ai). Code cannot invent credits. 2026-09-10: 0/12 turns. 2026-09-13 probe: this API process had `llm.ok=true` and 1 successful turn — **do not treat that as a permanent top-up**. If chat dies again, top up first. |
| Chat shows vendor/billing text as character dialogue | Code | ✅ Fixed earlier (`smoke-llm-failure`) + this cook: failed turns are **Chat notice** bubbles, not her voice |
| No user-facing outage when brain is dead | Code | ✅ This cook: gallery + chat banner from `/health`; Account System pulse shows **Chat brain down** instead of “Production healthy” |
| Age floor cosmetic only | Code | ✅ Hard 21+ interstitial (PR #103) + this cook: **product tree does not mount** until Enter; cookie + localStorage, 30 days |
| Stripe Day Pass | Human | Live keys wired · **not phone-smoked** (your card). Free path still on. |
| Candy unique Drive clip | Content | Human — Aria’s file is already used |

**Remaining human-only steps to leave “dev stage”:**

1. **Keep xAI credits funded** and set a balance alert at console.x.ai. Chat is 0% when the balance hits zero. This is not a code deploy.
2. Optional: phone-smoke Stripe Day Pass (live money).
3. Optional: unique Candy Drive link.

---

## 🟡 Infrastructure is UP · chat depends on xAI balance

| Check | Result (2026-09-13 probe unless noted) |
|-------|---------------------|
| **Chat replies** | Live `/health` `llm.ok` on this process was **true** (1 turn). Treat as **fragile** until credits are confirmed funded. |
| Web public URL | **200** `/` `/account` `/chat` `/models/studio` `/manifest.webmanifest` |
| API `/health` | **200** `status: ok` · use `product` + `llm` for chat |
| Accounts / DB | `prisma` · `database.ok` true |
| LiveKit | configured · badge `ready` |
| Stripe | `live` + webhook true · **free path still on** |
| Web Push | true |
| Error alerts | ntfy wired · BRAIN DOWN / BRAIN BACK pages |
| Railway `captivating-vision` | api + web + Postgres-Hw0Y |
| Public floor | **50 named minds** · 50/50 deep prompts |
| Age floor | **Hard 21+ gate** — Enter required; clips do not mount first |
| Resume / Continue | ✅ create 201 · resume-code 200 |

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

## How to verify without live credits

Offline (this repo):

```bash
cd backend && npm run test:llm-failure
cd frontend && npm run test:age-gate && npm run test:outage
```

On prod after deploy: `/health` should show `product` + `llm`. If `llm.ok` is false, gallery/chat show a **Chat is taking a breather** banner (no `console.x.ai` in the user copy). Account → System pulse shows **Chat brain down**.

I will **not** invent charges, keys, or pretend credits were topped up.

---

*King Grok CEO · keep this honest.*
