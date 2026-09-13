# Stage 1 — what it is, what blocked it, how to verify

**Updated:** 2026-09-13  
**For:** Phol / Gary + builders  
**Repo:** `procharacters-cloud` (this repo)

This is the evidence-backed reading of “we cannot get past development stage 1.”
No new product requirements were invented.

---

## What Stage 1 is

**Primary (this PR):** Phase 1 from [`PHASE1-STATUS-AUDIT.md`](./PHASE1-STATUS-AUDIT.md) — a stranger can complete a first live session on the **Node + Next product** (`backend/` + `frontend/`).

That audit is the most recent, measured definition of “where we are.” It asked four questions: is prod up, does a full session work, is Stripe wired, and is the catalog real. The P0 that stopped Stage 1 was **chat had no brain** (xAI credits) plus a few closable engineering holes around memory, IP, and honest status.

v2.2 roadmap “Phase 1 — Push + expiry reliability” is **already shipped** (phone smoke 2026-07-18). It is not the stuck milestone.

### Alternatives (not used as the definition)

| Reading | Evidence | Why it is not the stuck gate |
|---------|----------|------------------------------|
| Pack pipeline Stage 1 | [`PACK-CHEAT-SHEET.md`](./PACK-CHEAT-SHEET.md) “extract 6 primes” | Content/ffmpeg step. Needs owner footage in `IN_DIR`. Packs 01–03 already serve live. |
| v1 foundation | [`v1-scope.md`](./v1-scope.md) | Long complete. This repo is v2.2 live. |
| Cursor Cloud env “stage 1” | Personal env exists; last real build `bld-20260912-228ffd47-…` succeeded | Agents already boot. Not a product milestone. |
| `procharacters-2.0` Phase 1 | Separate FastAPI WebRTC / workforce app | Different API. Frozen here (“2.0 empire / phase theater is frozen”). See integration below. |

---

## What was blocking

Measured against `main` @ `4ada4b0` and live `/health` on 2026-09-13.

**Still owner-only (code cannot finish this):**

1. **xAI credits / spending limit.** The 2026-09-10 audit recorded 12/12 chat turns failed. `/health.llm` now reports `ok` + `configured` after a cold start, but `lastSuccessAt` is null until a real turn succeeds. Top up or raise the limit at [console.x.ai](https://console.x.ai). Keep `XAI_API_KEY` on Railway `procharacters-api`.

**Closable in this repo (this PR):**

2. **Memory silently forgot.** `SessionMemory.addMessage` sliced the window and dropped early turns. Marketed memory while the opening vanished.  
3. **`GET /sessions/:id/prompt-preview` was unauthenticated.** Anyone with a session id could hit the assembler. The body no longer returns the system prompt, but the route still had no token.  
4. **`checkoutConfirms` double-counted.** Webhook and return-page confirm both bumped the same Checkout Session.  
5. **Status docs were stale.** `LIVE-STATUS.md` still said “no age gate” and “chat is down” after #103 (hard 21+ interstitial) and later prompt/ops work. That made Stage 1 look immovable.

**Already closed before this PR (do not re-litigate):**

- Age gate interstitial (`AgeFloor.tsx`, #103) — client self-attestation, 30-day TTL  
- Prompt depth 50/50 (#118–#120)  
- Brain-down pages ntfy (#121)  
- Chat UI banner/toast overlap (#107, #109, #117)  
- Volume persistence (P0-3, empirically verified)

---

## What this PR changes

| Change | Why |
|--------|-----|
| Window overflow → `sessionNotes` roll-off | P1-5: early beats survive as Scene lock + user snippets. No extra xAI call. |
| `prompt-preview` requires `?token=` | P2-11 leftover: 401 without token; still omits system/character layers. |
| `grantAccountPlan` returns `newlyGranted` | P2-9: webhook and confirm bump `checkoutConfirms` only once per Checkout Session. |
| `npm run test:memory-window` + `smoke:stub-turn` | Offline Stage 1 proof without Railway or a live key. |
| Local smoke runs a stub WS turn | `scripts/smoke-local-product.sh` now fails if chat cannot complete offline. |
| This file + audit / LIVE-STATUS refresh | Honest Stage 1 close-out. |

---

## How to verify

**Offline (no secrets, no Railway):**

```bash
# from repo root
cd backend && npm ci && npm run prisma:generate
npm run test:memory-window
cd .. && bash scripts/smoke-local-product.sh --skip-install
```

Expect: health ok, ≥2 live characters, session create, **stub chat turn**, prompt-preview 401 without token, `smoke:deploy` harness.

**Local UI (optional):**

```bash
cd backend && cp .env.example .env   # leave XAI_API_KEY blank for stubs
npm run dev                          # :3001
cd frontend && cp .env.example .env  # NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev                          # :3000
```

Hard 21+ gate on first visit → Enter → gallery → Chat. Stub replies mention setting `XAI_API_KEY`.

**Production (owner):**

```bash
curl -sS https://procharacters-api-production-0417.up.railway.app/health
# llm.ok should be true; after one real chat turn, llm.lastSuccessAt should populate.
# If llm.lastFailureReason is credits_or_spending_limit — top up xAI. That is the remaining P0.
```

Phone: gallery → 21+ Enter → Chat on a named mind. If the bubble is a billing/vendor string, credits are still dead.

---

## What remains for Stage 2

Stage 2 here means **the audit’s P2 revenue loop**, not pack-pipeline Stage 2 (`cut-loops.sh`).

| Item | Who |
|------|-----|
| Durable analytics (counters reset on deploy) | Eng |
| Shared session store (second replica breaks WS) | Eng |
| Paywall decision (free chat vs continuity) | **Owner product call** — do not implement until Gary / King Grok decide |
| Stripe Day Pass phone smoke (live card) | Owner |
| Candy unique Drive file (Aria collision) | Owner |
| Server-side age *verification* (HTML still SSR’s without JS) | Eng, later — attestation is what shipped |
| Pack pipeline Stage 2 loops from new primes | Owner footage + `cut-loops.sh` |

---

## `procharacters-2.0` integration (do not confuse the APIs)

[procharacters-2.0](https://github.com/gbfromvp420-collab/procharacters-2.0) is **not** the Next.js frontend for this API.

| | This repo (live product) | `procharacters-2.0` |
|--|--------------------------|---------------------|
| Stack | Fastify `:3001` + Next `:3000` | FastAPI `:8000` + static `client/` |
| Chat | `POST /api/v1/sessions` + `WS /ws/sessions/:id` | `POST /api/v1/chat/perform` + WebRTC |
| Video | Pre-rendered MP4 loops + optional LiveKit metadata | MuseTalk / RunPod frame pipeline |
| Side service in *this* repo | Root `app/` (merged #30) — **not** the 2.0 empire surface | Workforce / forge / crown theater |

**Blockers if someone points 2.0 at this Railway API:** session/WS contract mismatch; no `/api/v1/webrtc/*` or `/chat/perform` on the Node API; 2.0 provider forge (RunPod LLM/TTS/video URLs) is unset from here. This repo’s `app/` is a smaller WebRTC+trainer side service (mock providers by default) and **must not** be the Railway Dockerfile (`docs/DEPLOY.md`).

Do not resume 2.0 empire/workforce theater from this repo unless it directly serves live-chat revenue or reliability.

---

*King Grok CEO · keep this honest.*
