# AGENTS.md

Operating guide for automated agents (and humans) working in this repo. For full
setup and command detail see [CONTRIBUTING.md](./CONTRIBUTING.md); for product
scope see the [README](./README.md) and [`docs/`](./docs).

## What this repo is

Procharacters.cloud — a live 21+ NSFW AI character chat platform. Three services:

| Path | Service | Stack |
| --- | --- | --- |
| `backend/` | Product API (REST + WebSocket + Grok + accounts) | Node 22, TypeScript (ESM) |
| `frontend/` | Product web (gallery / chat / Studio / account) | Next.js 15, React 19 |
| `app/` | Optional WebRTC signaling + trainer studio (side service) | Python 3.11+, FastAPI |

The Node packages are independent (no root `package.json`) — run npm commands
inside `backend/` or `frontend/`. The Prisma schema lives at `prisma/`.

## Quality gates (run before pushing)

CI is a single `CI` workflow whose **`all-green`** job is the required status.

- Backend: `cd backend && npm run lint && npm run typecheck && npm test && npm run build`
- Frontend: `cd frontend && npm run lint && npm test && npm run test:deeplink && npm run build`
- Python: `ruff check app && ruff format --check app && python scripts/run_all_tests.py --skip-stress`

Format the files you touch: `npm run format` in the package, `ruff format app` for
Python (Prettier `printWidth: 100`; CI enforces Prettier on changed files).

`npm run prisma:generate` (any `DATABASE_URL` value) must run before backend
typecheck/test/build if the generated client is missing.

## Guardrails (do not violate)

- **21+ only.** Every model and all copy depict consenting adults (21+).
- **Never rename live character IDs.** Pack 01/02/03 ids are stable in production;
  renaming breaks live catalog + saved sessions.
- **Redeploy safety:** the API image is `backend/Dockerfile`, web is
  `frontend/Dockerfile`. The root `Dockerfile` is the Python WebRTC service only —
  never point a product deploy at it.
- **Git:** Conventional Commits (`feat(scope):`, `fix:`, `chore(deps):`, `test:`,
  `docs:`). One logical change per commit. Do not force-push shared branches or
  amend merged commits. Stay on your branch.
- **No secrets in code.** The local dev flow needs none (`XAI_API_KEY`,
  `DATABASE_URL`, `LIVEKIT_*`, `STRIPE_*` are optional; unset = stub/JSON paths).

## Hot files (coordinate before editing)

These are large and central — avoid two agents editing them in parallel without a
merge plan, and expect reformat/rebase churn:

- `frontend/src/components/ChatApp.tsx`
- `backend/src/services/session-manager.ts`

## Testing expectations

- Add/extend vitest tests when changing pure logic in `backend/src/lib` or
  `frontend/src/lib`; prefer testing exported pure functions.
- `memory-manager` and `chat-orchestrator` are stateful classes with I/O — use
  fixtures/mocks if you test them.
- Demonstrate changes end-to-end where practical:
  `bash scripts/smoke-local-product.sh` boots the backend and hits health +
  characters + session create with no external services.

## Skills

Project SOPs live in `.grok/skills/` (e.g. `kgc-delegate`, `kgc-forge`,
`kgc-ops`, `kgc-return`, `kgc-smoke`). Read the relevant `SKILL.md` before working
in its lane.
