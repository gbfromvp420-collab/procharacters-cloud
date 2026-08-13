# Today’s phase list — 2026-08-13

**Owner:** King Grok CEO (final say on eng)  
**Boss Sr.:** Gary (phone smoke, footage, Stripe live money)  
**Command:** Say **next** / **cont** to keep shipping. Agents welcome.

---

## Goal for today

Railway is **live** at `59cd5c8`. Finish the **21+** sweep on prompts, gallery/chat footers, and forge/custom copy. Then content packs or optional Stripe smoke.

---

## Done (eng)

| # | Ship | Status |
|---|------|--------|
| 1 | Railway plan unlock · prod 200 | ✅ 2026-08-13 |
| 2 | Engineering smoke (health, gallery 8 minds, Diego session) | ✅ |
| 3 | Gary phone hard-refresh → gallery → Diego → one chat turn | ✅ |
| 4 | **Monorepo Prisma link** — `scripts/ensure-prisma-link.sh` | ✅ `59cd5c8` |
| 5 | **Local product smoke** — `scripts/smoke-local-product.sh` | ✅ `59cd5c8` |
| 6 | **Age floor 21+ models** | ✅ `59cd5c8` |
| 7 | Dual-stack monorepo docs after WebRTC #30 | ✅ `#31` |
| 8 | **Age floor 21+ prompts + UI + forge** | ✅ this cook |

---

## Still open

| Priority | Ship | Effort | Notes |
|----------|------|--------|-------|
| A | Dedicated avatar clips | Content | Gary footage → [DROP_IN.md](../frontend/public/avatar/packs/DROP_IN.md) |
| B | Optional Stripe Day Pass smoke | Human | Live money — free path always works |
| C | Studio DNA phone pass | S | Sign in → Forge → Save · Chat Now |

---

## Gary (human)

1. ~~Hard-refresh gallery → Diego → one chat~~ ✅  
2. After this deploy: hard-refresh again (21+ footer + Diego prompt)  
3. Optional: Stripe Day Pass, or `cook packs`

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
