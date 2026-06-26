# Procharacters.cloud

**KGC Ventures / Naughty Syntax**

Procharacters.cloud is a live character-chat stack with:

- a **Fastify backend** for session creation, WebSocket chat, prompt injection, and optional LiveKit sync
- a **Next.js frontend** for the chat UI and avatar playback
- a shared **prompt library** and **character registry** used by both services

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/` | Fastify API, WebSocket session server, xAI integration |
| `frontend/` | Next.js web client |
| `prompts/` | Versioned prompt library |
| `characters/` | Character registry and model metadata |
| `docs/` | Deployment and project planning docs |
| `scripts/` | Prompt and character inspection utilities |

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Default backend URL: `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Default frontend URL: `http://localhost:3000`

## Environment files

### `backend/.env`

Start from [`backend/.env.example`](backend/.env.example).

Important variables:

- `PUBLIC_API_URL` — required in deployed environments so session responses use the public HTTPS/WSS host
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — optional LiveKit room sync

### `frontend/.env.local`

Start from [`frontend/.env.example`](frontend/.env.example).

Important variables:

- `NEXT_PUBLIC_API_URL` — backend base URL used by the browser client

## Validation

- Backend: `npm run typecheck` and `npm run build`
- Frontend: `npm run build`

## Useful docs

- Backend details: [`backend/README.md`](backend/README.md)
- Deployment guide: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Gary notes: [`docs/README-for-Gary.md`](docs/README-for-Gary.md)

## Prompt and character utilities

**PowerShell**

```powershell
.\scripts\prompt_list.ps1
.\scripts\prompt_get.ps1 -Id twink-default
.\scripts\character_list.ps1
```

**Python**

```bash
python scripts/prompt_list.py
python scripts/prompt_get.py --id twink-default
python scripts/character_list.py
```

## Default characters

| Slot | Character | Status |
|------|-----------|--------|
| `default_male` | Twink Default | active |
| `default_female` | Female Default | active |

## License

Private — KGC Ventures. All rights reserved.