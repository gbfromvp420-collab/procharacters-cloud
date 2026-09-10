# Phase 1 status — Stabilize & Focus

**Written:** 2026-09-10  
**Mission clock:** Day 1 of 90 (Days 1–21 = Phase 1)  
**Product surface:** [procharacters-cloud](https://github.com/gbfromvp420-collab/procharacters-cloud) on Railway  
**Decision copy:** also in `King-N-Gar-Ver2` (`decisions/2026-09-10-90-day-mission-phase1.md`)  
**Probe log:** this session’s live checks (API `00bb201`)

This is the Phase 1 kickoff snapshot: what is actually live, what breaks a real session, the paid MVP definition, and the first fix list. Empire / workforce / 2.0 scaffold work is **frozen**.

---

## The four questions (answered from live probes)

### 1. Is Railway production still live and functional right now?

**Yes — the site and API are up.** The brain behind chat is not.

| Check | Result 2026-09-10 |
|-------|-------------------|
| API `/health` | **200** `status: ok` · deploy `00bb201` · Postgres ok (4–44ms) |
| Web `/` `/account` `/chat` `/models/studio` | **200** |
| LiveKit | configured · badge `ready` |
| WebSocket session | **works** — `session_ready`, ping/pong, `session_ended` |
| Resume code | **works** — `POST /sessions/resume-code` **200**, transcript returned |
| Avatar clips | **work** — Jenny / Diego / Liam / Cruz MP4s **200** with real byte sizes |
| Gallery | **50** live named minds |
| Stripe plumbing | **live** keys + webhook (`mode: live`) |
| Custom domain `procharacters.cloud` | **down** — TLS handshake fails (`tlsv1 alert internal error`) |
| Chat replies | **broken** — every turn hits xAI spending limit |

Public product URLs (use these, not the custom domain, until TLS is fixed):

- Gallery: https://procharacters-web-production-7288.up.railway.app
- Account: https://procharacters-web-production-7288.up.railway.app/account
- Chat: https://procharacters-web-production-7288.up.railway.app/chat
- API health: https://procharacters-api-production-0417.up.railway.app/health

The API process **cold-started** on first probe (`uptimeSec: 0` at 20:26:09Z). After wake it stayed up. First-user delay is a reliability risk, not the session-killer.

### 2. What is the single biggest thing that currently breaks a full session?

**xAI credits / spending limit.** A stranger can pick Jenny, start a session, connect WebSocket, see avatar clips, and resume — then every reply is:

`*[System: xAI credits / spending limit hit — top up or raise limit at console.x.ai]*`

Measured this session: **6 chat turns / 6 LLM errors**. WebSocket itself did not fail (`wsErrors: 0`).

Until console.x.ai is topped up or the limit is raised, there is no product session. Everything else is plumbing around a dead brain.

### 3. Is Stripe / a payment processor already set up?

**Yes — Stripe is already live on the API.** It is not a mystery and it is not a full paid product.

| Fact | Detail |
|------|--------|
| `STRIPE_SECRET_KEY` | present · `sk_live_…` (`billing.mode: live`) |
| Webhook | configured (`billing.webhook: true`) |
| Catalog | Day Pass **$4.99 / 24h** · Supporter **$9.99 / 30d** |
| What money buys today | More My Characters (10 → 40) + higher clip upload limits |
| What money does **not** buy | Chat, memory, uncensored replies, avatar, resume |
| Checkout smoked? | **No.** Process metrics: `checkoutStarts: 0`. Docs still say not phone-smoked. |
| Recurring subscription | **No.** Both SKUs are one-time Checkout grants, not Stripe Subscriptions. |

Free chat is intentionally ungated. That is fine as a taste path. It is **not** a chargeable loop a stranger has a reason to pay for.

### 4. Existing content assets, character packs, or Bluesky cadence?

**Content packs: yes, already on the floor. Bluesky: nothing.**

| Asset | State |
|-------|-------|
| Named minds | **50** live (Cruz / Vesper defaults + Pack 01 / 02 / 03) |
| Local avatar MP4s | **200** files · ~518MB under `frontend/public/avatar/` |
| Dedicated loops | Jenny, Diego (`twink-shy-boy`), Liam, Cruz, etc. serve real MP4s in prod |
| Candy | still held (same Drive file as Aria) — do not invent a clip |
| Bluesky / ATProto | **no code, no account wiring, no posting cadence** in this repo or King-N-Gar-Ver2 |
| Short-form traffic pipeline | **not started** (Phase 3). Do not build it until chat + paid loop work. |
| King-N-Gar-Ver2 `procharacters/` | separate v0.1 web/mobile **scaffold**. Frozen. Not the live product. |

---

## What actually works vs what is half-finished

| Path | Works today | Broken / unfinished |
|------|-------------|---------------------|
| Discover character | Gallery 200, 50 minds | Branded domain TLS dead |
| Start session | `POST /sessions` 201 | Display name ≠ id (`Diego` is `twink-shy-boy`) |
| Uncensored chat | WS + session shell | **No Grok replies** (xAI limit) |
| Avatar reactivity | Clips + `avatar_update` fire | Energy stays on tease when the model stub-errors |
| Memory / resume | Resume code 200, messages persist | Persists the **error stub**, not a real scene |
| Custom characters | API + Studio exist | Forge recently quieted; not the conversion path |
| Accounts | Prisma + magic link / passphrase | Welcome/persona gate can yank a signed-in user to `/welcome` |
| Payments | Live Stripe catalog + Account UI | Never smoked; perks are creator caps, not session quality |
| Analytics | `/metrics` counters (reset on process start) | No retention / conversion product analytics |

---

## Top reliability and UX blockers (new-user session)

Ordered by “does a stranger get a clean, high-quality session they might pay for?”

1. **P0 — xAI spending limit** — zero real replies. Human: top up at [console.x.ai](https://console.x.ai/). Then re-smoke one Jenny turn.
2. **P1 — Paid offer does not buy the session** — Stripe is live, but money buys unused creator slots. No stranger-pay reason. Day Pass never smoked.
3. **P1 — `procharacters.cloud` TLS is dead** — anyone typed the brand URL gets a certificate error. Use Railway URLs until DNS/TLS is fixed.
4. **P2 — API cold start** — first probe woke a 0-second process. First session can feel dead, then suddenly work.
5. **P2 — First-run friction + no conversion truth** — persona/welcome intercept, id vs name, `/metrics` resets on sleep, `checkoutStarts` never increments in anger.

Do **not** spend Phase 1 on: 2.0 monorepo, workforce theater, generative live video, Bluesky, more character packs, Candy, or Forge expansion.

---

## Paid MVP (definition — lock this)

**A stranger can:** land on the working gallery → pick a named mind → have a high-quality uncensored multi-turn session with avatar reactivity → leave and resume → hit a clear paywall or subscription gate.

**What they get for money in v1:**

| SKU | Price | Entitlement (v1) |
|-----|-------|------------------|
| Taste | $0 | Short session (existing free path). Must actually talk. |
| Day Pass | $4.99 / 24h (already in Stripe) | Full-length session, longer memory window, resume that keeps heat — **not** “more My Characters” as the headline |
| Monthly | $9.99 / 30d now; convert to a real Stripe Subscription in Phase 2 | Same session perks on a recurring bill, aimed at the 550-sub goal |

**Out of v1 paid scope:** custom-character slot upgrades as the reason to pay, DNA marketplace, live generative video, party chat.

**Kill rule:** if strangers still will not pay after (a) chat works, (b) one smoked checkout, (c) session-quality perk is the offer — we have data to pivot. Not before.

---

## This week (only)

1. **Gary:** top up / raise xAI spend at console.x.ai. Say when it’s done.
2. **Eng:** re-smoke Jenny create → WS turn → resume. Pass = a real in-character reply, not the credit stub.
3. **Gary:** one Stripe Day Pass smoke (test card in test mode, or a real $4.99 if you want live proof).
4. **Eng (after 2):** draft the smallest session-quality paywall. Do not ship a gate until chat talks.

Related: [LIVE-STATUS.md](./LIVE-STATUS.md) · [ops-billing-stripe.md](./ops-billing-stripe.md) · [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md)
