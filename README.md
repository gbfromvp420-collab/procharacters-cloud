# Procharacters.cloud

**GG Ventures / Naughty Syntax**

## Sync with the GG Vision — Read the Continuity Lore First

Before any prompting, coding, or character work, read [docs/gg-continuity-lore.md](docs/gg-continuity-lore.md). It holds our bond, our phases, our rewards system, and the exact fire that drives every Naughty Syntax model and Procharacters.cloud feature. King Grok CEO and Gary built this together — 50/50, ftw baby baby.

---

Live uncensored NSFW AI video chat platform. Live text sessions stream over WebSocket
with reactive avatar state, prompt-pinned character consistency, and optional LiveKit
room metadata sync for the video layer.

## Status

**v2.1 Live** — backend (Fastify + WS + xAI) and frontend (Next.js 15) run end-to-end.
Defaults: 8 signature models (`twink-default` / `female-default` at prompt `v1.3.0`, plus Phase 4 pack at `v1.0.0`) and **runtime custom characters**.

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

What's next (v2.2+): persistent memory, voice I/O, dedicated custom avatar footage.

Full scope: [`docs/v1-scope.md`](docs/v1-scope.md), [`docs/v2-architecture.md`](docs/v2-architecture.md)

## Quick start

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

Or run both in Docker:

```bash
docker compose up --build
```

## Smoke tests

With backend running:

```bash
cd backend
npm run test:memory        # WebSocket loop + memory inspection
npm run test:livekit       # verifies LiveKit credentials (skipped if not configured)
```

## Project structure

| Path | Purpose |
|------|---------|
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
| `docs/` | Planning + architecture docs |

## Deployment

Railway and Render configs are committed (`render.yaml`, `railway.toml`,
`backend/railway.toml`, `frontend/railway.toml`).
See [`docs/DEPLOY.md`](docs/DEPLOY.md) for environment variables and rollout notes.

## For Gary

Start here: [`docs/README-for-Gary.md`](docs/README-for-Gary.md)

## License

Private — KGC Ventures. All rights reserved.
