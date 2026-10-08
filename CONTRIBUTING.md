# Contributing to Procharacters.cloud

Product: live NSFW AI video chat (21+). Backend (Fastify + WS + xAI) + frontend
(Next.js 15) run end-to-end. A Python FastAPI WebRTC signaling + trainer studio
lives at repo root (`app/`) as an optional side service.

## Quick start

```bash
# Backend
cd backend
cp .env.example .env       # fill in XAI_API_KEY for real replies, blank for stubs
npm install
npm run dev                # http://localhost:3001

# Frontend (another shell)
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

Optional WebRTC + trainer studio (mock providers by default):

```bash
cp .env.example .env
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Checks before you push

```bash
# Backend
cd backend && npm run prisma:generate && npm run typecheck && npm run build
npm run test:reclaim-push && npm run test:memory-window

# Frontend
cd frontend && npm run lint && npx tsc --noEmit
npm run test:deeplink && npm run build
```

Offline product smoke (no Railway required):

```bash
bash scripts/smoke-local-product.sh
```

Python side service:

```bash
python3 scripts/run_all_tests.py --skip-stress
```

## PR checklist

- [ ] `npm run lint` (frontend) and `npm run typecheck` (backend) pass
- [ ] Product smoke passes (`scripts/smoke-local-product.sh` or equivalent)
- [ ] No secrets committed (`.env` files stay local; see `.env.example`)
- [ ] Railway/Render configs updated if env vars or Dockerfiles changed
- [ ] Docs touched if behavior changed (`docs/LIVE-STATUS.md`, roadmap checkboxes)

## Notes

- Root `Dockerfile` is the Python WebRTC service only. Product images are
  `backend/Dockerfile` and `frontend/Dockerfile` — never point a product
  deploy at the root Dockerfile.
- Custom characters persist to disk (`CUSTOM_CHARACTERS_PATH`, Railway volume
  `/data`); transcripts under `SESSIONS_PATH`.
- Age floor: all signature models and product copy are 21+ consenting adults.
