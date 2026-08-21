# Contributing to Procharacters.cloud

Thanks for helping build the product. This guide covers local setup, the quality
gates CI enforces, and the PR workflow. For product scope and architecture, start
with the [README](./README.md) and the docs under [`docs/`](./docs).

## Repository layout

| Path | What | Toolchain |
| --- | --- | --- |
| `backend/` | Product API — Fastify REST + WebSocket + Grok + accounts | Node 22, TypeScript (ESM) |
| `frontend/` | Product web — Next.js 15 gallery / chat / Studio / account | Node 22, React 19 |
| `app/` | Optional WebRTC signaling + trainer studio (side service) | Python 3.11+ (FastAPI) |
| `prisma/` | Postgres schema (accounts) shared by the backend | Prisma 7 |

The Node packages are independent (no root `package.json`); run commands from
inside `backend/` or `frontend/`.

## Prerequisites

- **Node 22** and npm.
- **Python 3.11+** with `python3-venv` (for the optional `app/` service).
- No secrets are required for local development: the backend runs with JSON
  accounts and stub chat replies when `XAI_API_KEY`/`DATABASE_URL` are unset.

## Setup

```bash
# Backend API (http://localhost:3001)
cd backend
npm ci
npm run prisma:generate            # generates the Prisma client (needs DATABASE_URL set to any value)
npm run dev

# Frontend web (http://localhost:3000) — in another shell
cd frontend
npm ci
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev

# Optional WebRTC / trainer studio (http://localhost:8000)
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
VIDEO_PROVIDER=mock LLM_PROVIDER=mock python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Quality gates

CI runs a single **`CI`** workflow whose **`all-green`** job is the one required
status. Run the matching gates locally before pushing.

### Backend (`backend/`)

```bash
npm run lint          # ESLint (@typescript-eslint)
npm run typecheck     # tsc --noEmit
npm test              # vitest
npm run build         # prisma generate + tsc
npm run format        # Prettier write (or format:check to verify)
```

### Frontend (`frontend/`)

```bash
npm run lint          # next lint (next/core-web-vitals)
npm test              # vitest + React Testing Library
npm run test:deeplink # autostart / deep-link checks
npm run build         # next build
npm run format        # Prettier write (or format:check to verify)
```

### Python (`app/`)

```bash
ruff check app                       # lint (rules pinned in pyproject.toml)
ruff format --check app              # formatting (ruff format to fix)
python scripts/run_all_tests.py --skip-stress
```

### Formatting

Prettier (`printWidth: 100`) covers `frontend/` and `backend/`; `ruff format`
covers `app/`. CI enforces Prettier on the files a PR changes, so **format the
files you touch** (`npm run format` in the package, `ruff format app` for Python).

## Commit & branch conventions

- Use **Conventional Commits**: `feat(scope): …`, `fix(scope): …`,
  `chore(scope): …`, `test(scope): …`, `docs: …`.
- One logical change per commit; keep PRs focused.
- Never rename live character IDs (Pack 01/02/03 ids are stable in production).
- Do not force-push shared branches or amend merged commits.

## Pull requests

1. Branch off the current development branch.
2. Make the change and run the relevant gates above.
3. Open a PR — the template prompts for summary, changes, testing, and a
   pre-merge checklist. Keep the title in Conventional Commits form.
4. Ensure the `CI / all-green` check passes.

## Content policy

This is an uncensored **21+** adult platform. All signature models and product
copy depict consenting adults (21+). Keep that floor in any content or copy work.
