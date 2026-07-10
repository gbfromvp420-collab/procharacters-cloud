# Procharacters.cloud

**KGC Ventures / Naughty Syntax**

Live uncensored NSFW AI video chat platform. Live text sessions stream over WebSocket
with reactive avatar state, prompt-pinned character consistency, and optional LiveKit
room metadata sync for the video layer.

## Status

**v2 Live MVP** — backend (Fastify + WS + xAI) and frontend (Next.js 15) are wired
together and run end-to-end. Default characters: `twink-default`, `female-default`
(both at prompt `v1.2.0`).

What works today:
- `POST /api/v1/sessions` creates a session and returns a WebSocket URL
- WS messages: `user_message`, `ping`, `end_session` → `session_ready`,
  `assistant_stream`, `assistant_complete`, `avatar_update`, `session_ended`, `error`
- LiveKit room metadata sync (when `LIVEKIT_*` env vars are set)
- Stub replies when `XAI_API_KEY` is missing or still a placeholder
- Session-scoped memory (cleared on session end)

What's next (v2.1+): persistent memory across sessions, model switching in UI,
custom character creation, voice I/O.

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