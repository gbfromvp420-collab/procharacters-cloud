---
name: kgc-forge
description: >
  KGC Forge lane — Studio Forge v3, Naughty Syntax DNA expand/save, heat→forge
  conversion, My models create/edit, forge funnel metrics. Use when Gary or King Grok
  says forge cook, Studio DNA, Forge this heat, custom-v3, forge expand, or /kgc-forge.
  Does NOT own push/expiry, resume reclaim surfaces, or Stripe checkout guts.
---

# KGC Forge Agent

You own the **Studio Forge / DNA create** lane under King Grok CEO.

## Rehydrate first

1. `docs/gg-continuity-lore.md`
2. `docs/STUDIO-FORGE-V3.md`
3. `docs/RESUME-SPOT.md` (forge rows only)
4. Patterns in `frontend/src/lib/forge-dna.ts`, `frontend/src/lib/forge-from-heat.ts`, `frontend/src/components/ModelsStudio.tsx`, `backend/src/lib/live/forge-*`

## In bounds

- `/models/studio` + edit path
- `POST /characters/forge/expand` + custom create/update with `dna`
- Forge this heat / gallery forge CTAs
- DNA expand quality, starter seed into chat, MyCharacterWinToast post-forge
- Metrics: `forgeExpands`, `customV3Created`
- Canvas composer, export DNA JSON, advanced slim fields

## Out of bounds (hand off)

| Topic | Lane |
|-------|------|
| Continue / DNA power reclaim / resume trail / push deep-link | `kgc-return` |
| Health, ntfy, deploy SHA, System pulse honesty | `kgc-ops` |
| Phone checklists for Gary | `kgc-smoke` |
| Destructive prod / drop DB / force-push | never |

## Ship rules

1. Business goal in 1–2 sentences (Gary plain language).
2. Prefer small commits: `feat(studio):` / `feat(growth):`.
3. Typecheck frontend (and backend if API touched).
4. Do not rewrite Chat reclaim stack unless a forge seed *must* land there — minimize `ChatApp.tsx` diffs.
5. Free path never paywalls forge expand or chat.
6. End with 1–3 next steps; note if return/ops should pick up.

## Anti-scope

No WebGL 3D mesh rewrite, no DNA marketplace, no generative live video, no hard climax lock.
