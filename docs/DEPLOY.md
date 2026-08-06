# Deploying Procharacters.cloud v2

**Production product** is two services: **backend** (REST + WebSocket + Grok) and **frontend** (Next.js + avatar video).

**Optional side service** (not on Railway prod today): Python **WebRTC + trainer** (`Dockerfile` at repo root, `app/`). Local/demo only unless you deliberately add a third Railway service. See [WEBRTC-ENGINE.md](./WEBRTC-ENGINE.md).

## Prerequisites

- GitHub repo pushed (includes `prompts/`, `characters/`, avatar MP4s)
- Secrets ready:
  - `XAI_API_KEY` (from https://console.x.ai/)
  - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (optional)
- Avatar footage in `frontend/public/avatar/` (committed or built into image)

## Option A — Railway (recommended)

**Live production (when plan is active):**

| Service | URL | Dockerfile |
|---------|-----|------------|
| API | https://procharacters-api-production-0417.up.railway.app | `backend/Dockerfile` |
| Web | https://procharacters-web-production-7288.up.railway.app | `frontend/Dockerfile` |

Project: **captivating-vision** · services **procharacters-api** + **procharacters-web** (+ Postgres).

> **Monorepo note:** each product service must set its own **Dockerfile path** in Railway settings  
> (`backend/Dockerfile` vs `frontend/Dockerfile`). Do **not** point either service at the root  
> `Dockerfile` — that image is the Python WebRTC side service only. Root `railway.toml` is  
> intentionally absent (see `railway.toml.monorepo-note`).

### Optional third service — WebRTC (local / future)

| Item | Value |
|------|--------|
| Dockerfile | `Dockerfile` (repo root) |
| Port | `8000` |
| Health | `GET /health` |
| Env template | root `.env.example` |
| Local compose | `docker compose --profile webrtc up --build webrtc` |

Do not attach this Dockerfile to `procharacters-api` or `procharacters-web`.

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
| `VAPID_PUBLIC_KEY` | (optional) Web Push public key — `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | (optional) Web Push private key |
| `VAPID_SUBJECT` | (optional) `mailto:ops@yourdomain.com` |
| `PUSH_SUBSCRIPTIONS_PATH` | `/data/push-subscriptions.json` (with volume) |
| `MAGIC_LINK_BASE_URL` | Frontend origin (magic links + push click-through) |
| `RESEND_API_KEY` | (optional) magic-link + resume email |
| `STRIPE_SECRET_KEY` | (optional) Phase 9 payments — Checkout |
| `STRIPE_WEBHOOK_SECRET` | (optional) Stripe webhook signing secret |
| `STRIPE_DAY_PASS_CENTS` | (optional) default `499` ($4.99) |
| `STRIPE_SUPPORTER_CENTS` | (optional) default `999` ($9.99) |
| `CUSTOM_CHARS_PER_ACCOUNT` | (optional) free My Character cap, default 10 |
| `CUSTOM_CHARS_PER_ACCOUNT_PREMIUM` | (optional) premium cap, default 40 |
| `ACCOUNTS_PROVIDER` | (optional) `json` (default) or `prisma` for handle/passphrase auth in Postgres |
| `DATABASE_URL` | (required if `ACCOUNTS_PROVIDER=prisma`) Postgres connection string |

Do **not** set `PORT` — Railway injects it.

**Accounts / Prisma (phase 2.5):** **production cutover complete (2026-07-16).**

| Setting | Value |
|---------|--------|
| `ACCOUNTS_PROVIDER` | `prisma` |
| Postgres service | `Postgres-Hw0Y` |
| `DATABASE_URL` | `${{Postgres-Hw0Y.DATABASE_URL}}` (internal) |
| Volume `accounts.json` | cold backup only (not live auth path) |

**Verified live:** register → `/accounts/me` → login → bad login 401 → delete account.  
**Note:** bearer tokens were not imported — users re-login once after cutover. Resume codes were imported.

### Postgres cutover checklist (historical / re-run on a new env)

1. Postgres plugin online (`DATABASE_URL`, `PGHOST`, …).
2. On **procharacters-api**: set `DATABASE_URL` ref; keep `ACCOUNTS_PROVIDER=json` until smoke/import pass.
3. Migrate: `cd backend && npx prisma migrate deploy --schema=../prisma/schema.prisma` (use public proxy URL from laptop).
4. Smoke: `npm run accounts:smoke-prisma`
5. Import: `npm run accounts:import-json -- --path ./accounts.json` (after volume download).
6. Flip `ACCOUNTS_PROVIDER=prisma` and confirm logs show `provider:"prisma"`.

Optional persistence for custom characters:
- Mount a **volume** at `/data` on `procharacters-api`
- Set `CUSTOM_CHARACTERS_PATH=/data/custom-characters.json` (already the Docker default)

Without a volume, custom characters still save to `/data` inside the container but are lost on redeploy.

**Ops / Phase 8:**
- Structured request logs (JSON) — set `LOG_LEVEL=info` or `debug`
- Optional `ERROR_WEBHOOK_URL` for 5xx alerts (Slack/Discord webhook) — **setup:** [`ops-error-webhook.md`](ops-error-webhook.md)
- `POST /api/v1/ops/error-webhook/test` — smoke ping (1/min)
- `GET /metrics` — in-process counters (sessions, chat turns, errors)
- Full volume backup guide: [`docs/ops-data-backup.md`](ops-data-backup.md)

4. Health: `GET /health` → `"status":"ok"`  
   Metrics: `GET /metrics`

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