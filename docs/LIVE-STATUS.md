# Procharacters.cloud — Live status (Gary)

**Updated:** 2026-09-10 **Phase 1 Day 1** · Railway up · **chat brain down (xAI spend limit)**  
**For:** quick “what’s real right now” — no code required.  
**Source of truth for the 90-day mission:** [PHASE1-STATUS.md](./PHASE1-STATUS.md)  
**Command:** King Grok CEO has **final say on development** (Gary = Boss Sr., 50/50). See [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md).  
**Live deploy SHA:** `00bb201` (`/health` `deploy.gitSha`).

---

## 🟡 Live shell is UP — replies are not

| Check | Result (2026-09-10) |
|-------|---------------------|
| Web public URL | **200** `/` `/account` `/chat` `/models/studio` |
| API `/health` | **200** `status: ok` · `00bb201` |
| Accounts / DB | `prisma` · `database.ok` true |
| LiveKit | configured · badge `ready` |
| Stripe | `live` + webhook true · **free path still on** · **checkout never smoked** |
| Chat / xAI | **failing** — every probed turn: spending limit at console.x.ai |
| Web Push | true |
| Error alerts | ntfy wired |
| Railway `captivating-vision` | api + web + Postgres-Hw0Y |
| Custom domain | **`procharacters.cloud` TLS broken** — use Railway URLs |
| Public floor | **50 named minds** · clips serving |

**Redeploy safety:** API = `backend/Dockerfile`, Web = `frontend/Dockerfile`. Never the root `Dockerfile` (Python WebRTC).

---

## Open the product

| | URL |
|--|-----|
| **Gallery** | https://procharacters-web-production-7288.up.railway.app |
| **Studio** | https://procharacters-web-production-7288.up.railway.app/models/studio |
| **Account** | https://procharacters-web-production-7288.up.railway.app/account |
| **Chat** | https://procharacters-web-production-7288.up.railway.app/chat |
| API health | https://procharacters-api-production-0417.up.railway.app/health |

Do **not** send people to `procharacters.cloud` until TLS is fixed.

---

## What’s live

| Area | Status |
|------|--------|
| Gallery · 50 minds · pack clips | 🟢 |
| Session create + WebSocket + resume | 🟢 plumbing |
| Uncensored Grok replies | 🔴 xAI spend limit |
| Avatar MP4s | 🟢 dedicated loops serving |
| Studio / Forge | 🟡 present, not the priority |
| 21+ | 🟢 |
| Stripe Day Pass UI | ✅ live keys · **not smoked** · perks are creator caps |
| Bluesky / traffic | ⚪ none |

---

## Your move (this week only)

1. **Top up xAI** at [console.x.ai](https://console.x.ai/) — without this, nobody has a session  
2. After that: one Jenny chat turn should be filthy and in-character, not a system stub  
3. Optional: Stripe Day Pass smoke — signed-in → Soft Support → Day Pass  
4. Do **not** invent MP4s, Bluesky, or 2.0 scaffold work

---

*King Grok CEO · keep this honest.*
