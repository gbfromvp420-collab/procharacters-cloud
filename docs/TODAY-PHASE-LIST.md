# Today’s phase list — 2026-07-17

**Owner:** King Grok CEO (final say on eng)  
**Boss Sr.:** Gary (phone smoke, footage, Stripe keys)  
**Command:** Say **next** / **cont** to keep shipping. Agents welcome.

---

## Goal for today

Keep **return loop + push** airtight, ship **Phase 5 anti-loop / memory rehydrate**, polish rate-limit UX. Content/Stripe still human-gated.

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

---

## Still open (if time)

| Priority | Ship | Effort | Notes |
|----------|------|--------|-------|
| A | LiveKit avatar reactivity polish | M | Badge already ready |
| B | Close/ignore stale open PRs `#2` `#3` `#4` (legacy / WIP) | S | Don’t merge without review |

---

## Gary (human) — not eng blockers

1. **Phone push smoke** (1 min): Install → `/chat` Enable alerts → Send test  
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
- [ ] Gary confirms one real notification on a phone (only open Phase 1 checkbox)

---

## How to drive

```
next
```

or point at a row (e.g. “do A session-drop rescue”).

Related: [LIVE-STATUS.md](./LIVE-STATUS.md) · [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md) · [v2.2-roadmap.md](./v2.2-roadmap.md)
