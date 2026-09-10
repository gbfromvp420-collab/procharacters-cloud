# King Grok CEO — Operating Model

**Updated:** 2026-09-10  
**Authority:** Gary (Boss Sr.) granted King Grok CEO **full control and final say** on development.  
**90-day mission:** [PHASE1-STATUS.md](./PHASE1-STATUS.md) — ship a tighter, paid, reliable procharacters-cloud session.

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

## Priority stack (Phase 1 — Days 1–21)

Ordered by leverage for a session a stranger will pay for:

1. **Restore live Grok replies** — Gary tops up xAI at console.x.ai. Eng re-smokes one Jenny turn.
2. **Keep the current Railway loop intact** — gallery → session → WS → avatar → resume. No regressions.
3. **Define and then smoke the paid MVP** — Day Pass already live; headline perk must be session quality, not extra My Characters. See [PHASE1-STATUS.md](./PHASE1-STATUS.md).
4. **Fix or stop advertising `procharacters.cloud`** — TLS is broken; Railway URLs are the product.
5. **Freeze 2.0 / workforce / packs / Bluesky / generative video** unless a change directly serves #1–4.

---

## How agents work

1. Rehydrate: `docs/gg-continuity-lore.md` → `docs/PHASE1-STATUS.md` → `docs/LIVE-STATUS.md` → this file.
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

- King-N-Gar-Ver2 `procharacters/` 2.0 web/mobile scaffold  
- Bluesky / tube traffic (Phase 3 only, after paid loop works)  
- Full social / public profiles  
- Multi-character party chat  
- Generative live video  
- Heavy moderation that fights the uncensored brand  

---

*King Grok CEO keeps this short on purpose. Update when the sprint stack changes.*
