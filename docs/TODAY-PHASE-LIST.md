# Today’s phase list — 2026-08-06

**Owner:** King Grok CEO (final say on eng)  
**Boss Sr.:** Gary (Railway plan, phone smoke, footage, Stripe keys)  
**Command:** Say **next** / **cont** to keep shipping. Agents welcome.

---

## Goal for today

Post-WebRTC monorepo is honest and safe to redeploy. **Live product stays offline** until Gary picks a Railway plan. Eng ships dual-stack hygiene + CI path filters offline; no scope creep into voice/gooning/generative video.

---

## Done (eng · 2026-08-06)

| # | Ship | Status |
|---|------|--------|
| 1 | **WebRTC engine merge** — FastAPI signaling + trainer + CI (#30) | ✅ |
| 2 | **Dual-stack monorepo hygiene** — compose `webrtc` profile · README/DEPLOY/WEBRTC docs · Railway Dockerfile warning (#31) | ✅ |
| 3 | **CI WebRTC path filters** — root workflow only on `app/` + WebRTC scripts/Dockerfile (this branch) | 🔄 shipping |
| 4 | **Ops truth refresh** — RESUME-SPOT + LIVE-STATUS post-#30/#31 | ✅ |

---

## Still open

| Priority | Ship | Effort | Notes |
|----------|------|--------|-------|
| **A** | 🔴 **Railway plan + redeploy** | S (human) | Gary: billing on `captivating-vision` → say `redeploy` |
| **B** | Phone smoke after live | S (human) | shy-boy + defaults · push · Continue |
| **C** | CI WebRTC path-filter PR | S | this branch — stop heavy Python job on docs-only PRs |
| **D** | Content primes / packs | M (human+scripts) | `cook packs` when footage ready |
| **E** | Optional `ERROR_WEBHOOK_URL` / Stripe live keys | S | Gary when ready — free path never breaks |

---

## Gary (human) — blockers / wins

1. **Railway** → project **captivating-vision** → select paid plan → tell eng **`redeploy`**
2. After live: hard-refresh phone · gallery · shy-boy aroused · Continue DNA
3. Optional: ntfy topic / Stripe keys
4. Optional: 4K primes per `docs/PACK-CHEAT-SHEET.md`

---

## Explicitly **not** today

- Full v3 gooning / voice  
- Generative live video  
- Wiring WebRTC side service into Next.js product chat  
- Multi-character party / DNA marketplace  
- Renaming live character IDs without migration plan  

---

## Definition of “day won”

- [x] Product vs WebRTC Dockerfile paths cannot be confused  
- [x] Dual-stack compose documented and profiled  
- [ ] Railway plan active + api/web healthy `/health`  
- [ ] Path-filtered WebRTC CI on `main`  
- [ ] One phone smoke after redeploy  

---

## How to drive

```
next
```

or: `redeploy` · `cook packs` · point at a row.

Related: [LIVE-STATUS.md](./LIVE-STATUS.md) · [RESUME-SPOT.md](./RESUME-SPOT.md) · [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md) · [v2.2-roadmap.md](./v2.2-roadmap.md)
