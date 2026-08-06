# procharacters WebRTC + Trainer Studio

FastAPI service for **WebRTC signaling**, **character chat / performance**, and a **model fine-tuning (trainer) studio** with live **character / LoRA hot-swapping** in the browser client.

> **Monorepo placement (post-#30):** this tree lives at the **repo root** (`app/`, root `Dockerfile`, root `requirements.txt`, root `.env.example`). It is a **side service** next to the product stack (`backend/` Fastify + `frontend/` Next.js). It does **not** replace live Railway chat. Product deploys must keep using `backend/Dockerfile` and `frontend/Dockerfile` only.

| Layer | What it does |
|-------|----------------|
| WebRTC API | SDP offer/answer, ICE candidates, session bind, hangup |
| Chat perform | LLM + video providers (mock or RunPod) via `MediaBridge` |
| Trainer | Dataset upload, RunPod training jobs, weight registry |
| Static client | `app/static/index.html` — camera preview, connect, chat, hot-swap UI |

---

## Requirements

- **Python 3.11+** (3.14 works for local smoke; CI uses 3.11)
- Optional: **Docker** + Compose for production-style deploy
- Optional: real **RunPod** endpoints for GPU MuseTalk / LLM / training

---

## Quick start (local Uvicorn)

```bash
# 1. Environment
cp .env.example .env
# edit .env as needed — defaults use mock providers

# 2. Dependencies
python3 -m pip install -r requirements.txt

# 3. Run the API + static client
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open **http://127.0.0.1:8000/** for the browser client.

Health check:

```bash
curl -fsS http://127.0.0.1:8000/health
```

---

## Environment setup (`.env.example`)

Copy the template and fill secrets **only in** `.env` (never commit `.env`):

```bash
cp .env.example .env
```

### Provider selection

| Variable | Values | Default |
|----------|--------|---------|
| `VIDEO_PROVIDER` | `mock` \| `runpod` | `mock` |
| `LLM_PROVIDER` | `mock` \| `runpod` | same as `VIDEO_PROVIDER` if unset |

### RunPod inference

| Variable | Purpose |
|----------|---------|
| `RUNPOD_MUSETALK_URL` | MuseTalk / talking-head endpoint base URL |
| `RUNPOD_LLM_URL` | Character LLM endpoint base URL |
| `RUNPOD_API_KEY` | Bearer token for RunPod |
| `RUNPOD_TIMEOUT_SECONDS` | Request timeout (default `30`) |
| `RUNPOD_FALLBACK_TO_MOCK` | Fall back to mock on network errors (`true`/`false`) |

### Training & weights

| Variable | Purpose |
|----------|---------|
| `RUNPOD_TRAINING_URL` | Remote training worker (Kohya / Unsloth / XTTS) |
| `RUNPOD_TRAINING_API_KEY` | Optional; falls back to `RUNPOD_API_KEY` |
| `WEIGHTS_STORAGE_BUCKET` | Bucket / prefix for trained weights & datasets |

### WebRTC ICE (STUN / TURN)

| Variable | Purpose |
|----------|---------|
| `WEBRTC_STUN_URLS` | Comma-separated STUN URLs (public Google defaults) |
| `WEBRTC_TURN_URLS` | Optional TURN URLs for NAT beyond LAN |
| `WEBRTC_TURN_USERNAME` | TURN username |
| `WEBRTC_TURN_CREDENTIAL` | TURN credential |

`iceServers` are exposed by:

- `GET /api/v1/webrtc/ice-servers`
- `POST /api/v1/webrtc/session` and `GET /api/v1/webrtc/session/{id}`

---

## WebRTC character hot-swapping

The static client (`app/static/index.html`) loads trained weights from the registry and can switch identity **without dropping** an active peer connection.

### UI flow

1. **Refresh weights** — `GET /api/v1/trainer/weights` fills Character / LoRA dropdowns.
2. **Init session** or **Connect** — binds identity via `POST /api/v1/webrtc/session` (includes `iceServers`).
3. **Connect (offer)** — `POST /api/v1/webrtc/offer` with `character_id` + optional `lora_id`.
4. **Swap Character** — re-POSTs session with the new character/LoRA; **does not** renegotiate SDP or hang up.
5. **Send chat/perform** — `POST /api/v1/chat/perform` with the same ids; weights flow into RunPod/mock providers.

### API sketch

```http
POST /api/v1/webrtc/session
{"session_id":"…","character_id":"nova","lora_id":"lora-nova-v2"}

POST /api/v1/webrtc/offer
{"session_id":"…","sdp":"…","type":"offer","character_id":"nova","lora_id":"lora-nova-v2"}

POST /api/v1/chat/perform
{"session_id":"…","character_id":"nova","lora_id":"lora-nova-v2","message":"hello"}
```

Register weights for the dropdown:

```http
POST /api/v1/trainer/weights/register
{"character_id":"nova","kind":"visual_lora","lora_id":"lora-nova-v2","set_active":true}
```

---

## API surface (selected)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/` | Browser WebRTC client |
| `GET` | `/health` | Liveness + provider flags |
| `GET` | `/api/v1/webrtc/ice-servers` | STUN/TURN list |
| `POST` | `/api/v1/webrtc/session` | Create/update session + ICE + weights |
| `POST` | `/api/v1/webrtc/offer` | SDP offer → answer |
| `POST` | `/api/v1/webrtc/hangup` | Tear down session |
| `POST` | `/api/v1/chat/perform` | Chat + performance (versioned) |
| `POST` | `/chat/perform` | Legacy alias |
| `POST` | `/api/v1/trainer/dataset` | JSON base64 dataset |
| `POST` | `/api/v1/trainer/dataset/upload` | Multipart binary upload |
| `POST` | `/api/v1/trainer/start-job` | Start training job |
| `GET` | `/api/v1/trainer/weights` | List registry |
| `GET` | `/api/v1/trainer/weights/resolve` | Active weights for character/LoRA |

---

## Docker deployment

Multi-stage image (Python 3.11, FFmpeg/libav for PyAV & aiortc):

```bash
cp .env.example .env   # set TURN + RunPod secrets for production

docker compose up -d --build

docker compose ps
docker compose logs -f signaling

curl -fsS http://localhost:8000/health
```

Useful Compose notes:

- Service name: **`signaling`** (image `procharacters-webrtc:latest`)
- Port: **`8000`**
- Volume: **`trainer_data`** → `/app/data/trainer` (datasets + weight index)
- Healthcheck: `GET /health`

Stop / remove:

```bash
docker compose down
# docker compose down -v   # also drop trainer_data volume
```

---

## Test suite

Unified runner (smokes + stress):

```bash
python3 scripts/run_all_tests.py
```

### What it runs

| Order | Suite | Description |
|------:|-------|-------------|
| 1 | `smoke_full_pipeline.py` | Weights registry → MediaBridge → API hot-swap |
| 2 | `smoke_trainer_pipeline.py` | Dataset validation, mock training jobs |
| 3 | `smoke_runpod_provider.py` | Provider factories, timeouts, fallback |
| 4 | `smoke_static_webrtc.py` | HTML client markers + WebRTC/chat routes |
| 5 | `stress_webrtc_sessions.py` | N concurrent sessions (default 20); auto-starts Uvicorn if needed |

### Options

```bash
python3 scripts/run_all_tests.py --skip-stress
python3 scripts/run_all_tests.py --stress-sessions 10 --stress-concurrency 10
python3 scripts/run_all_tests.py --fail-fast --verbose
python3 scripts/run_all_tests.py --only smoke_static
```

Standalone stress (requires a live server, or start one yourself):

```bash
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
python3 scripts/stress_webrtc_sessions.py --sessions 20 --concurrency 20
```

### CI

GitHub Actions workflow **`CI WebRTC`** (`.github/workflows/ci.yml`) runs when WebRTC paths change
(`app/**`, root `Dockerfile` / `requirements.txt`, WebRTC smoke scripts, this doc) — **not** on pure product/docs PRs:

- Ubuntu + **Python 3.11**
- System libs for FFmpeg / PyAV / aiortc
- `pip install -r requirements.txt`
- `python3 scripts/run_all_tests.py --verbose`
- Manual: **workflow_dispatch** anytime

Product gates remain separate: `ci-backend.yml` · `ci-frontend.yml`.

---

## Project layout (inside monorepo)

```
# WebRTC side service (this doc)
app/
  main.py                 # FastAPI app, WebRTC + chat routes
  media_bridge.py         # Provider-agnostic LLM + video orchestration
  core/config.py          # Settings from environment
  api/routes/trainer.py   # Trainer + weight registry HTTP API
  services/
    llm/                  # mock + RunPod LLM
    video/                # mock + MuseTalk RunPod
    trainer/              # dataset, RunPod jobs, weight registry
  static/index.html       # Browser client (hot-swap UI)
scripts/
  run_all_tests.py        # Unified WebRTC test runner
  smoke_*.py              # Smoke suites (also pack scripts for product)
  stress_webrtc_sessions.py
Dockerfile                # WebRTC image ONLY
requirements.txt
.env.example              # WebRTC / RunPod / ICE template
.github/workflows/ci.yml  # Python 3.11 smoke + stress

# Product stack (separate — do not confuse)
backend/                  # Fastify live chat API (Railway procharacters-api)
frontend/                 # Next.js gallery/chat/studio (Railway procharacters-web)
docker-compose.yml        # product default; profile "webrtc" starts this service
```

### Compose profile

```bash
cp .env.example .env
docker compose --profile webrtc up --build webrtc
# http://127.0.0.1:8000/
```

---

## License / ops notes

- Default mode is **safe for local demo**: `VIDEO_PROVIDER=mock`, `LLM_PROVIDER=mock`.
- For external WebRTC peers, configure **TURN** (`WEBRTC_TURN_*`); STUN alone is often not enough across symmetric NAT.
- Do not commit `.env` or real API keys.
