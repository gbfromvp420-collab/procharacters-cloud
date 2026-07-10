# Deploying Procharacters.cloud v2

Two services: **backend** (REST + WebSocket + Grok) and **frontend** (Next.js + avatar video).

## Prerequisites

- GitHub repo pushed (includes `prompts/`, `characters/`, avatar MP4s)
- Secrets ready:
  - `XAI_API_KEY` (from https://console.x.ai/)
  - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (optional)
- Avatar footage in `frontend/public/avatar/` (committed or built into image)

## Option A — Railway (recommended)

**Live production (July 2026):**

| Service | URL | Dockerfile |
|---------|-----|------------|
| API | https://procharacters-api-production-0417.up.railway.app | `backend/Dockerfile` |
| Web | https://procharacters-web-production-7288.up.railway.app | `frontend/Dockerfile` |

Project: **captivating-vision** · services **procharacters-api** + **procharacters-web**.

> **Monorepo note:** each service must set its own **Dockerfile path** in Railway settings  
> (`backend/Dockerfile` vs `frontend/Dockerfile`). The root `railway.toml` alone is not enough for both.

### 1. Backend service (`procharacters-api`)

1. Connect GitHub repo **`procharacters-cloud`**
2. **Settings → Build**:
   - Builder: **Dockerfile**
   - Dockerfile path: `backend/Dockerfile`
   - Root directory: empty / repo root
3. **Variables**:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `REPO_ROOT` | `/app` |
| `HOST` | `0.0.0.0` |
| `PUBLIC_API_URL` | `https://procharacters-api-production-0417.up.railway.app` |
| `XAI_API_KEY` | `<your_xai_api_key>` |
| `XAI_MODEL` | `grok-3` |
| `LIVEKIT_URL` | `wss://....livekit.cloud` (optional) |
| `LIVEKIT_API_KEY` | (optional) |
| `LIVEKIT_API_SECRET` | (optional) |

Do **not** set `PORT` — Railway injects it.

4. Health: `GET /health` → `"status":"ok"`

### 2. Frontend service (`procharacters-web`)

1. Same repo · Dockerfile path: `frontend/Dockerfile` · root empty
2. **Variable** (must be present at **build** time):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://procharacters-api-production-0417.up.railway.app` |

3. Redeploy after changing `NEXT_PUBLIC_API_URL` (baked into the Next bundle).

### 3. Smoke test

```bash
curl https://procharacters-api-production-0417.up.railway.app/health
curl -X POST https://procharacters-api-production-0417.up.railway.app/api/v1/sessions ^
  -H "Content-Type: application/json" -d "{\"characterId\":\"twink-default\"}"
```

Open the frontend URL → Start Session → chat. WebSocket should use `wss://` automatically.

---

## Option B — Render

1. **New → Blueprint** → connect repo → uses `render.yaml`
2. Set sync=false secrets in Render dashboard:
   - `PUBLIC_API_URL` = `https://procharacters-api.onrender.com` (your API URL)
   - `NEXT_PUBLIC_API_URL` = same API URL
  - `XAI_API_KEY`, LiveKit vars
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
| Stub replies only | Set `XAI_API_KEY` on backend service |