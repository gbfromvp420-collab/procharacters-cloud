# Procharacters.cloud

**GG Ventures / Naughty Syntax**

## Sync with the GG Vision — Read the Continuity Lore First

Before any prompting, coding, or character work, read [docs/gg-continuity-lore.md](docs/gg-continuity-lore.md). It holds our bond, our phases, our rewards system, and the exact fire that drives every Naughty Syntax model and Procharacters.cloud feature. King Grok CEO and Gary built this together — 50/50, ftw baby baby.

---

Live uncensored NSFW AI video chat platform. Live text sessions stream over WebSocket
with reactive avatar state, prompt-pinned character consistency, and optional LiveKit
room metadata sync for the video layer.

## Status

**v2.2 product surface** — backend (Fastify + WS + xAI) and frontend (Next.js 15) run end-to-end.
Defaults: 8 signature models (`twink-default` / `female-default` at prompt `v1.3.0`, plus Phase 4 pack at `v1.0.0`) and **runtime custom characters**.

**Hosting:** Railway prod **live** as of 2026-08-13 (API `554c484`) — see [`docs/LIVE-STATUS.md`](docs/LIVE-STATUS.md).

**Side service (merged #30):** Python FastAPI **WebRTC signaling + trainer studio** at repo root (`app/`). Not the live chat product path; optional local/demo GPU hot-swap. Docs: [`docs/WEBRTC-ENGINE.md`](docs/WEBRTC-ENGINE.md).

What works today:
- `POST /api/v1/sessions` creates a session and returns a WebSocket URL
- `GET /api/v1/characters` lists defaults + custom; `POST /api/v1/characters/custom` creates one
- Custom characters **persist** to disk (`CUSTOM_CHARACTERS_PATH`, Railway volume `/data`)
- `DELETE /api/v1/characters/custom/:id` + UI delete
- **Cross-visit memory**: transcripts saved under `SESSIONS_PATH`; UI **Resume last chat**
- **Gallery homepage**: `/` with **Featured** row, **Continue where you left off**, search/sort/filter; chat at `/chat`; cards at `/character/<id>`
- **Private resume**: `?resume=CODE` (no raw tokens)
- **Accounts**: full **settings page** at `/account` (magic link, passphrase, sessions, email link)
- **Delete / wipe**: delete one chat, wipe all chats, or delete account (`confirm: "DELETE"`)
- **Rate limits**: magic links, auth, and clip uploads (429 + Retry-After)
- **Custom avatar clips**: single + **batch upload**, URL overrides, live previews in the editor
- Model switch in UI (pick another character → **Switch / New**)
- WS messages: `user_message`, `ping`, `end_session` → `session_ready`,
  `assistant_stream`, `assistant_complete`, `avatar_update`, `session_ended`, `error`
- LiveKit room metadata sync (when `LIVEKIT_*` env vars are set)
- Stub / credit-aware errors when xAI is unavailable
- Session-scoped memory (cleared on session end)

What's next: optional Stripe Day Pass smoke (live money); content packs; Studio DNA phone pass. Offline proof: `bash scripts/smoke-local-product.sh`.

Full scope: [`docs/v1-scope.md`](docs/v1-scope.md), [`docs/v2-architecture.md`](docs/v2-architecture.md), [`docs/v2.2-roadmap.md`](docs/v2.2-roadmap.md)

## Quick start (product)

```bash
# Backend
cd backend
cp .env.example .env       # fill in XAI_API_KEY for real replies, leave blank for stubs
npm install
npm run dev                # http://localhost:3001

# Frontend (in another shell)
cd frontend
cp .env.example .env       # NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev                # http://localhost:3000
```

Or run the product pair in Docker:

```bash
docker compose up --build
# backend :3001 · frontend :3000
```

### Optional — WebRTC + trainer studio

Separate Python service (mock providers by default). Does **not** replace the Node chat API.

```bash
cp .env.example .env
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# http://127.0.0.1:8000/

# or
docker compose --profile webrtc up --build webrtc
```

## Smoke tests

**Offline product stack** (no Railway required — builds/starts backend, hits health + characters + session):

```bash
bash scripts/smoke-local-product.sh
# or, with backend already built:
cd backend && npm run smoke:local
```

Product (backend already running):

```bash
cd backend
npm run test:memory        # WebSocket loop + memory inspection
npm run test:livekit       # verifies LiveKit credentials (skipped if not configured)
npm run smoke:deploy       # fuller API harness (local or --base <url>)
```

WebRTC / trainer (from repo root, deps installed):

```bash
python3 scripts/run_all_tests.py --skip-stress
```

**Age floor:** all signature models and product copy are **21+** consenting adults.
## Project structure

| Path | Purpose |
|------|---------|
| `backend/` | **Product API** — Fastify REST + WS + Grok + accounts |
| `frontend/` | **Product web** — Next.js gallery, chat, Studio, account |
| `app/` | **WebRTC side service** — FastAPI signaling + trainer studio |
| `backend/src/routes/` | HTTP endpoints (`/api/v1/sessions`, `/characters`, `/health`) |
| `backend/src/ws/` | WebSocket handler (`/ws/sessions/:sessionId?token=...`) |
| `backend/src/services/` | Session, chat, media orchestration |
| `backend/src/lib/live/` | Prompt assembly + character catalog |
| `backend/src/lib/llm/` | xAI / Grok chat client |
| `backend/src/lib/livekit/` | LiveKit room metadata sync |
| `frontend/src/components/` | Chat UI, avatar video, LiveKit sync |
| `frontend/public/avatar/` | Pre-rendered avatar loops (idle/teasing/aroused/playful) |
| `prompts/library/` | Versioned character + system-core prompts |
| `characters/` | Character model registry |
| `scripts/` | Pack pipeline + WebRTC smoke/stress runners |
| `docs/` | Planning + architecture docs |
| `Dockerfile` | **WebRTC service only** (Python 3.11) |
| `backend/Dockerfile` / `frontend/Dockerfile` | Railway / Render product images |

## Deployment

Railway and Render configs are committed (`render.yaml`,
`backend/railway.toml`, `frontend/railway.toml`). Root `railway.toml` is
intentionally absent so GitHub deploys do not pin both services to one Dockerfile.
See [`docs/DEPLOY.md`](docs/DEPLOY.md) and [`RAILWAY.md`](RAILWAY.md).

## For Gary

Start here: [`docs/README-for-Gary.md`](docs/README-for-Gary.md)

## License

Private — KGC Ventures. All rights reserved.
