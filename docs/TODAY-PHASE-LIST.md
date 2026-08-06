# Today’s phase list — 2026-08-06

**Owner:** King Grok CEO (final say on eng)  
**Boss Sr.:** Gary (Railway plan, phone smoke, footage, Stripe keys)  
**Command:** Say **next** / **cont** to keep shipping. Agents welcome.

---

## Goal for today

Prod is **offline** (Railway trial). Ship **offline ops pack** so local stack stays proveable, and harden **21+ age floor** across canon. When plan unlocks: redeploy + phone smoke.

---

## Done (eng) — continue-again

| # | Ship | Status |
|---|------|--------|
| 1 | **Monorepo Prisma link** — `scripts/ensure-prisma-link.sh` + `npm run prisma:generate` | ✅ |
| 2 | **Local product smoke** — health + characters + session (`scripts/smoke-local-product.sh`) | ✅ |
| 3 | **CI Backend** — uses ensure-prisma-link + local product smoke | ✅ |
| 4 | **Age floor 21+** — models, prompts, UI footers, forge/custom copy | ✅ |
| 5 | Dual-stack monorepo docs after WebRTC #30 | ✅ prior `#31` |

---

## Still open

| Priority | Ship | Effort | Notes |
|----------|------|--------|-------|
| A | **Railway plan** | Human | Gary selects plan on `captivating-vision` |
| B | **Redeploy api+web** | S | `backend/Dockerfile` + `frontend/Dockerfile` only |
| C | Phone smoke after live | S | push + shy-boy + defaults |
| D | Optional ERROR_WEBHOOK_URL re-test | S | after live |

---

## Gary (human)

1. Railway → project **captivating-vision** → choose a plan  
2. Say **`redeploy`**  
3. Hard-refresh phone → push Send test  

---

## Explicitly **not** today

- Full v3 gooning / voice  
- Generative live video  
- Renaming live character IDs (Mateo/Diego roster stays)

---

## How to drive

```
next
```

Offline proof anytime:

```bash
bash scripts/smoke-local-product.sh
```

Related: [LIVE-STATUS.md](./LIVE-STATUS.md) · [RESUME-SPOT.md](./RESUME-SPOT.md) · [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md)
