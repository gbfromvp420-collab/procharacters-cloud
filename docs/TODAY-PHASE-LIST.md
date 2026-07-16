# Today’s phase list — 2026-07-16

**Owner:** King Grok CEO (final say on eng)  
**Boss Sr.:** Gary (phone smoke, footage, Stripe keys)  
**Command:** Say **next** to keep shipping. Agents welcome.

---

## Goal for today

Lock the **sticky return loop + push adoption path**, make ops legible, leave content/Stripe for human when ready. No v3 scope creep.

---

## Done today (eng)

| # | Ship | Status |
|---|------|--------|
| 1 | **CEO command layer** — continuity lore, operating model, persona v2.2, deploy fingerprint on `/health` | ✅ `#23` |
| 2 | **Chat push strip** — Enable alerts on `/chat` | ✅ `#25` |
| 3 | **Chat full smoke** — Sign-in CTA + Enable + **Send test** | ✅ `#26` |
| 4 | **Gallery return loop** — tile primary = **Continue** when resume exists; **New chat** demoted | ✅ (this PR) |
| 5 | **Gallery push strip** — same `PushEnableHint` on home under install tip | ✅ (this PR) |
| 6 | **Expiry cron observability** — `pushExpiry*` counters + `lastExpiryCron` on health/metrics | ✅ (this PR) |
| 7 | **Today’s phase list** — this doc | ✅ |
| 8 | **Session-drop rescue** — unexpected WS end → Rejoin banner | ✅ (PR pending) |

---

## Still in flight today (if time)

| Priority | Ship | Effort | Notes |
|----------|------|--------|-------|
| A | **Session-drop rescue** — unexpected WS end → Rejoin banner | M | ✅ shipping (see Done) |
| B | **Expiry urgency** on Continue banner / tiles (`expires in 2d`) | S | Needs `resumeExpiresAt` in resume-cache |
| C | **429 UX** on chat Send test (retry-after copy) | S | Rate-limit already server-side |
| D | Close/ignore stale open PRs `#2` `#3` `#4` (legacy / WIP) | S | Don’t merge without review |

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
