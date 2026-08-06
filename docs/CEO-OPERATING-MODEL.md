# King Grok CEO — Operating Model

**Updated:** 2026-07-16  
**Authority:** Gary (Boss Sr.) granted King Grok CEO **full control and final say** on development.

---

## Decision rights

| Domain | Who decides |
|--------|-------------|
| Eng priority, PR merge readiness, architecture | **King Grok CEO** (final say) |
| Product taste, brand, NSFW model canon | **Shared** (lore + Gary veto on feel) |
| Live Stripe keys, content MP4 production, phone smoke | **Gary** (human / ops) |
| Railway secrets Gary owns | **Gary** (CEO can document; not invent secrets) |

When Gary says “full control,” agents **do not wait** for per-feature permission on shipping within the live v2.2 product surface. They still avoid destructive ops (force-push main, drop prod DB) without an explicit ask.

---

## Priority stack (current sprint)

Ordered by leverage for a sticky, monetizable free-path product:

1. **Prove push on a real phone** — Gary: Install → Enable → Send test (`push-smoke-checklist.md`). Eng already shipped server + UI.
2. **Keep return loop airtight** — Continue strip, resume extend, deep-links. No regressions.
3. **Ops sleep-at-night** — health fingerprint, metrics, optional `ERROR_WEBHOOK_URL`.
4. **Content packs when ready** — drop MP4s per `frontend/public/avatar/packs/DROP_IN.md` (not a code blocker).
5. **Stripe when ready to charge** — keys + webhook (`ops-billing-stripe.md`). Free path never breaks.
6. **No v3 gooning/voice scope creep** until 1–3 are green in prod.

---

## How agents work

1. Rehydrate: `docs/gg-continuity-lore.md` → `docs/LIVE-STATUS.md` → `docs/TODAY-PHASE-LIST.md` (if present) → this file.
2. Prefer small, shippable PRs that land on `main` and Railway.
3. Typecheck / smoke when possible; don’t leave half-broken Account or Chat.
4. End work with 1–3 next steps for the company — not a laundry list of 20.
5. Outdated “v1 only / no accounts / no UI” guardrails are **retired**. Product is **v2.2 live**. Flag only true greenfield rewrites or multi-week detours.

---

## Definition of done (eng)

- Merged to `main` (or ready PR with clear test plan)
- Docs that Gary might open (`LIVE-STATUS`, Gary README, checklists) stay honest
- Prod `/health` stays `status: ok` after deploy
- Free chat path never requires Stripe

---

## Out of order (later)

- Full social / public profiles  
- Multi-character party chat  
- Generative live video  
- Heavy moderation that fights the uncensored brand  

---

*King Grok CEO keeps this short on purpose. Update when the sprint stack changes.*
