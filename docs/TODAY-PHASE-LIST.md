# Today’s phase list — 2026-07-18

**Owner:** King Grok CEO (final say on eng)  
**Boss Sr.:** Gary (phone smoke, footage, Stripe keys)  
**Command:** Say **next** / **cont** to keep shipping. Agents welcome.

---

## Goal for today

Keep **return loop + push** airtight. Gary confirmed **phone push**. Ship **LiveKit avatar reactivity polish**. Content/Stripe still human-gated.

---

## Done (eng)

| # | Ship | Status |
|---|------|--------|
| 1 | **CEO command layer** — continuity lore, operating model, persona v2.2, deploy fingerprint on `/health` | ✅ |
| 2 | **Chat push strip** — Enable alerts on `/chat` | ✅ |
| 3 | **Chat full smoke** — Sign-in CTA + Enable + **Send test** | ✅ |
| 4 | **Gallery return loop** — tile primary = **Continue** when resume exists; **New chat** demoted | ✅ |
| 5 | **Gallery push strip** — same `PushEnableHint` on home under install tip | ✅ |
| 6 | **Expiry cron observability** — `pushExpiry*` counters + `lastExpiryCron` on health/metrics | ✅ |
| 7 | **Today’s phase list** — this doc | ✅ |
| 8 | **Session-drop rescue** — unexpected WS end → Rejoin banner | ✅ |
| 9 | **Expiry urgency** — Continue banner / tiles show `expires in 2d` | ✅ |
| 10 | **Phase 5 anti-loop + memory rehydrate** — unchained continuity, session restore scene blurb | ✅ `f4218eb` live |
| 11 | **429 UX** on chat/account Send test — “try again in Ns” from Retry-After | ✅ |
| 12 | **CharacterSession Prisma** — durable summary + kink + history; forget-me clears both | ✅ |
| 13 | **LiveKit avatar reactivity polish** — sticky energy bands, updatedAt merge, crossfade fix, band pulse | ✅ |
| 14 | **Memory stickiness pass** — scene lock every turn, prior seed, resume dossier refresh, sticky default Remember, strip chips | ✅ |
| 15 | **Repo hygiene** — close stale PRs `#1` `#2` `#3` `#4` `#29`; ship split CI + PR template (salvage from `#4`) | ✅ |
| 16 | **Ops evening sprint** — Azure deploy → manual-only; Account **System pulse**; Continue **Copy code** | ✅ |

---

## Still open (if time)

| Priority | Ship | Effort | Notes |
|----------|------|--------|-------|
| A | ~~Close/ignore stale open PRs `#1` `#2` `#3` `#4` `#29`~~ | S | ✅ closed 2026-07-18 — do not merge; CI salvaged from `#4` |
| B | Optional ops: `ERROR_WEBHOOK_URL` | S | Gary sets on Railway — pulse chip shows on/off |

---

## Gary (human) — not eng blockers

1. ~~**Phone push smoke**~~ ✅ Gary confirmed (2026-07-18)  
2. Optional: `ERROR_WEBHOOK_URL` on Railway API  
3. Optional: Stripe keys when ready to charge  
4. Optional: drop 4K MP4 packs per `DROP_IN.md`

---

## Explicitly **not** today

- Full v3 gooning / voice  
- Generative live video  
- Dedicated filmed packs (content production)  
- Multi-character party chat / social profiles  

---

## Definition of “day won”

- [x] Push can be enabled + tested **without** hunting Account  
- [x] Gallery doesn’t fat-finger **new chat** over **continue**  
- [x] Ops can see deploy SHA + expiry cron heartbeat  
- [x] Gary confirms one real notification on a phone  
- [x] Avatar loops react smoothly (no band thrash; LiveKit/WS merge)

---

## How to drive

```
next
```

or point at a row (e.g. “do A session-drop rescue”).

Related: [LIVE-STATUS.md](./LIVE-STATUS.md) · [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md) · [v2.2-roadmap.md](./v2.2-roadmap.md)
