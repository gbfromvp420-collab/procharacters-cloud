# GrokBuild Directive v1.0 — Humanized Balanced 4K Character Packs

**Status:** Active doctrine (2026-07-20)  
**Owner:** Gary (content) · King Grok CEO (eng integrate)  
**Ops sheet:** [PACK-CHEAT-SHEET.md](./PACK-CHEAT-SHEET.md)

---

## Mission

Shift from kink-compacted niche IDs as the public face to **realistic, humanized characters** with **flexible tagging**. Deliver balanced, high-obsession assets for Naughty Syntax reactive avatars.

---

## Core rules

1. Every **4K Pack** = exactly **6 characters**: **3 female + 3 male**.  
2. **Human names primary** (e.g. Maria Murillo, Hector Garcia, Sofia Reyes, Diego Morales).  
3. **4 loopable clips** per character: `idle`, `teasing`, `playful`, `aroused`  
   - **5–8s**, H.264, **silent** audio, **9:16** preferred.  
4. Use **tags** for variety (`brat`, `gym-rat`, `soft-goth`, `alt-punk`, `athletic`, `shy`, …)  
   — do **not** hard-code kink into the only identity string users see.  
5. **Templates / bases:** engine still uses `female-default` + `twink-default` footage bases;  
   pack slots `female-default1…3` / `male-default1…3` for content planning.

---

## Pipeline

| Step | Action |
|------|--------|
| 1 | Stage 1: extract **6 primes** (20–30s) from inventory |
| 2 | Stage 2: `cut-loops.sh` (or batch) per prime → 4 loops |
| 3 | Theming: other Grok → full character defs from **name + tags** |
| 4 | Update [PACK-CHEAT-SHEET.md](./PACK-CHEAT-SHEET.md) roster |
| 5 | Drop into `frontend/public/avatar/<live-folder>/` → **`packs ready`** → verify + ship |

Scripts: `scripts/extract-prime-clips.sh` · `scripts/cut-loops.sh` · `scripts/cut-loops-batch.sh`

---

## Pack 01 proposal (locked in cheat sheet)

| Slot | Name | Tags |
|------|------|------|
| female-default1 | Maria Murillo | playful-brat |
| female-default2 | Sofia Reyes | soft-goth |
| female-default3 | Luna Vargas | athletic-tease |
| male-default1 | Hector Garcia | gym-rat |
| male-default2 | Diego Morales | shy-twink |
| male-default3 | Alex Rivera | alt-punk |

**Live drop folders** (path-stable until registry expands):  
`female-playful-brat` · `female-soft-goth` · `female-athletic-tease` · `twink-gym` · `twink-shy-boy` · `twink-alt-punk`

---

## Out of scope (this directive)

- Generative live video  
- Renaming URL/session IDs without a migration plan  
- More than 6 characters per pack without a Pack 02 sheet  

---

*GrokBuild v1.0 · Naughty Syntax · 50/50*
