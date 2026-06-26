# Deploying Procharacters.cloud v2

Two services: **backend** (REST + WebSocket + Grok) and **frontend** (Next.js + avatar video).

## Prerequisites

- GitHub repo pushed (includes `prompts/`, `characters/`, avatar MP4s)
- Secrets ready:
  - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (optional)
- Keep those values only in your deployment provider's secret dashboard or a local untracked `.env`.
- If any secret is exposed in chat, screenshots, logs, or a tracked file, revoke it and rotate it before the next deploy.
- Avatar footage in `frontend/public/avatar/` (committed or built into image)

## Option A — Railway (recommended)

### 1. Backend service

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → repo **`procharacters-cloud`**
2. **Confirm the connected repo** — logs must show `node dist/index.js`, **not** Python/uvicorn/FastAPI
3. **Settings → Build**:
   - Builder: **Dockerfile** (not Nixpacks)
   - Dockerfile path: `backend/Dockerfile`
   - Root directory: `/` (repo root)
3. **Variables**:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `REPO_ROOT` | `/app` |
| `HOST` | `0.0.0.0` |
| `PUBLIC_API_URL` | `https://<your-backend>.up.railway.app` |
| `LIVEKIT_URL` | `wss://....livekit.cloud` (optional) |
| `LIVEKIT_API_KEY` | (optional) |
| `LIVEKIT_API_SECRET` | (optional) |

4. **Settings** → generate domain → copy HTTPS URL → set `PUBLIC_API_URL` to that URL
5. **Deploy** — health check: `GET /health`

### 2. Frontend service

1. Same project → **Add Service** → Dockerfile: `frontend/Dockerfile`, context `.`
2. **Build variable** (Railway → Variables → add at build time):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://<your-backend>.up.railway.app` |

3. Generate public domain for the frontend (e.g. `https://<app>.up.railway.app`)

### 3. Smoke test

```bash
curl https://<backend>/health
curl -X POST https://<backend>/api/v1/sessions -H "Content-Type: application/json" -d "{\"characterId\":\"twink-default\"}"
```

Open the frontend URL → Start Session → chat. WebSocket should use `wss://` automatically.

---

## Option B — Render

1. **New → Blueprint** → connect repo → uses `render.yaml`
2. Set sync=false secrets in Render dashboard only:
   - `PUBLIC_API_URL` = `https://procharacters-api.onrender.com` (your API URL)
   - `NEXT_PUBLIC_API_URL` = same API URL
   - LiveKit vars
3. Deploy both services

---

## Option C — Docker Compose (local prod test)

```powershell
cd C:\Users\gbvp6\Documents\procharacters-cloud
docker compose up --build
```

- Frontend: http://localhost:3000  
- Backend: http://localhost:3001  

Uses `backend/.env` for secrets.

---

## Production notes

| Topic | Detail |
|-------|--------|
| **WebSocket** | Backend must be on a host that supports WebSocket (Railway/Render/Fly do) |
| **HTTPS** | Set `PUBLIC_API_URL` to your public `https://` API URL so sessions return `wss://` links |
| **Sessions** | In-memory only — restarts clear active sessions (OK for v2 MVP) |
| **Video assets** | Served from frontend `public/avatar/` (~50 MB total) |
| **CORS** | Backend allows all origins (`origin: true`) — tighten before public launch |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `python-multipart` / `uvicorn` / FastAPI crash | **Wrong repo or builder** — service is not running `procharacters-cloud` Node backend. Reconnect GitHub repo, force **Dockerfile** `backend/Dockerfile` |
| Chat works locally, not deployed | Check `NEXT_PUBLIC_API_URL` matches backend HTTPS URL |
| WebSocket fails | Confirm `PUBLIC_API_URL` on backend; browser must use `wss://` |
| Character/prompt errors | Ensure Docker image includes `prompts/` + `characters/` (`REPO_ROOT=/app`) |
| Stub replies only | LLM not configured — wire up a chat client in `chat-orchestrator.ts` |