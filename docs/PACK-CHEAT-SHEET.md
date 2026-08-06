# 4K pack cheat sheet (Gary)

**Doctrine:** [GrokBuild Directive v1.0 — Humanized Balanced 4K Packs](./GROKBUILD-4K-PACKS-v1.md)  
Full cut guide: [GARY-PACK-EDITING.md](./GARY-PACK-EDITING.md) · drop-in: `frontend/public/avatar/packs/DROP_IN.md`

---

## Core rules (v1.0)

| Rule | Spec |
|------|------|
| **Pack size** | Exactly **6 characters**: **3 female + 3 male** |
| **Names** | **Human names primary** (Maria Murillo, Hector Garcia…) |
| **Tags** | Flexible vibe tags (`playful-brat`, `gym-rat`, `soft-goth`…) — **not** hard-coded into identity |
| **Clips** | 4 loops: `idle` · `teasing` · `playful` · `aroused` |
| **Clip specs** | **5–8s**, H.264, **silent**, **9:16** preferred |
| **Bases** | Duplicate/edit from `female-default` / `twink-default` (engine) · pack slots `female-default1…3` / `male-default1…3` |

**Shift:** realistic, humanized, high-obsession — not kink-compacted niche-only IDs as the public face.

---

## First pack (Pack 01 · Humanized Balanced)

| Pack slot | Display name | Tags | Live drop folder *(until registry expands)* | Avatar base |
|-----------|--------------|------|-----------------------------------------------|-------------|
| `female-default1` | **Maria Murillo** | playful-brat | `female-playful-brat` | female-default |
| `female-default2` | **Sofia Reyes** | soft-goth | `female-soft-goth` | female-default |
| `female-default3` | **Luna Vargas** | athletic-tease | `female-athletic-tease` | female-default |
| `male-default1` | **Hector Garcia** | gym-rat | `twink-gym` | twink-default |
| `male-default2` | **Diego Morales** | shy-twink | `twink-shy-boy` | twink-default |
| `male-default3` | **Alex Rivera** | alt-punk | `twink-alt-punk` | twink-default |

> **Eng note:** Drop MP4s into **live drop folder** so gallery/chat pick them up *today* without a catalog rewrite. Pack slots + human names are the content doctrine; registry display-name renames can ship when defs are themed.

---

## Folder / naming rules

**Don’t:** `Anna4kpack`, spaces, mixed case, “4k” in the folder name, kink-only public labels without a human name.

**Do:**

| Layer | Example |
|-------|---------|
| Human name (gallery / chat) | Maria Murillo |
| Tags (mind / search / forge) | `playful-brat`, `tease` |
| Live folder (repo path) | `frontend/public/avatar/female-playful-brat/` |
| Pack slot (content sheet) | `female-default1` |

```
frontend/public/avatar/<live-drop-folder>/
  idle.mp4
  teasing.mp4
  playful.mp4
  aroused.mp4
```

---

## Pipeline

1. **Stage 1** — Extract **6 primes** (20–30s) from inventory  
   `scripts/extract-prime-clips.sh`  
2. **Stage 2** — `cut-loops.sh` per prime → 4 loops (5–8s, fades)  
   Map primes → live drop folder via `id-map`  
3. **Theming** — Other Grok: full character defs from **name + tags**  
4. **This sheet** — Update roster status / primes / offsets  
5. **Integrate** — `cp packs/<id>/*.mp4 frontend/public/avatar/<live-folder>/` → **`packs ready: <id>`**

```bash
# Stage 1
IN_DIR=. OUT_DIR=./new_chars_batch DURATION=25 MAX_CHARS=6 \
  bash scripts/extract-prime-clips.sh

# Stage 2 (one)
bash scripts/cut-loops.sh ./new_chars_batch/maria_prime_25s.mp4 female-playful-brat

# Stage 2 (batch + map)
bash scripts/cut-loops-batch.sh ./new_chars_batch ./scripts/id-map.pack01.txt

# Optional force 9:16
SCALE_9_16=1 DURATIONS='6 6 7 6' bash scripts/cut-loops.sh ./primes/x_prime_25s.mp4 twink-gym
```

Defaults: offsets `0 6 12 18`, durations `6 5 7 5` (aim **5–8s**), fade **0.4s**, CRF **22**, silent H.264.

---

## Files (engine — only these)

```
idle.mp4
teasing.mp4
playful.mp4
aroused.mp4
```

| | |
|--|--|
| Required | **4 MP4s only** |
| Codec | H.264 `.mp4` |
| Aspect | **9:16** preferred |
| Length | **5–8s** loopable |
| Audio | **silent** |
| Loop | first frame ≈ last frame |

---

## Master list · Pack 01 (edit as you go)

**Status:** `Themed in other Grok` · `Packs ready` · `Integrated` · `Needs retweak` · `Prime pending`

### Template

```markdown
### <pack-slot> — <Human Name>
- **Tags**: …
- **Live folder**: …
- **Prime clip**: path/to/whatever_prime_25s.mp4
- **Loops generated**: packs/<live-folder>/{idle,teasing,playful,aroused}.mp4
- **Offsets/Durations used**: 0/6, 6/5, 12/7, 18/5
- **Status**: …
- **Notes**: …
```

### female-default1 — Maria Murillo
- **Tags**: playful-brat
- **Live folder**: `female-playful-brat`
- **Prime clip**: _(TBD)_
- **Loops generated**: packs/female-playful-brat/{idle,teasing,playful,aroused}.mp4
- **Offsets/Durations used**: 0/6, 6/5, 12/7, 18/5
- **Status**: Prime pending
- **Notes**: First pack · playful brat energy, humanized not niche-only

### female-default2 — Sofia Reyes
- **Tags**: soft-goth
- **Live folder**: `female-soft-goth`
- **Prime clip**: _(TBD)_
- **Loops generated**: packs/female-soft-goth/{idle,teasing,playful,aroused}.mp4
- **Offsets/Durations used**: 0/6, 6/5, 12/7, 18/5
- **Status**: Prime pending
- **Notes**: Soft candle / hover / edge

### female-default3 — Luna Vargas
- **Tags**: athletic-tease
- **Live folder**: `female-athletic-tease`
- **Prime clip**: _(TBD)_
- **Loops generated**: packs/female-athletic-tease/{idle,teasing,playful,aroused}.mp4
- **Offsets/Durations used**: 0/6, 6/5, 12/7, 18/5
- **Status**: Prime pending
- **Notes**: Mat cool-down / stretch / hold

### male-default1 — Hector Garcia
- **Tags**: gym-rat
- **Live folder**: `twink-gym`
- **Prime clip**: _(TBD)_
- **Loops generated**: packs/twink-gym/{idle,teasing,playful,aroused}.mp4
- **Offsets/Durations used**: 0/6, 6/5, 12/7, 18/5
- **Status**: Prime pending
- **Notes**: Post-set / flex / burn

### male-default2 — Diego Morales
- **Tags**: shy-twink
- **Live folder**: `twink-shy-boy`
- **Prime clip**: _(TBD)_
- **Loops generated**: packs/twink-shy-boy/{idle,teasing,playful,aroused}.mp4
- **Offsets/Durations used**: 0/6, 6/5, 12/7, 18/5
- **Status**: Prime pending
- **Notes**: Shy still / peek / nervous *(live id stays twink-shy-boy for paths)*

### male-default3 — Alex Rivera
- **Tags**: alt-punk
- **Live folder**: `twink-alt-punk`
- **Prime clip**: _(TBD)_
- **Loops generated**: packs/twink-alt-punk/{idle,teasing,playful,aroused}.mp4
- **Offsets/Durations used**: 0/6, 6/5, 12/7, 18/5
- **Status**: Prime pending
- **Notes**: Bored-hot / mesh / brat edge

### Pack 02+ (extra slots)

### _(pack-slot)_ — _(Human Name)_
- **Tags**:
- **Live folder**:
- **Prime clip**:
- **Loops generated**:
- **Offsets/Durations used**: 0/6, 6/5, 12/7, 18/5
- **Status**:
- **Notes**:

---

## Hand-off

1. Four loops in **live drop folder**  
2. Update this sheet (prime path + status)  
3. Tell King Grok: **`packs ready: female-playful-brat`** (or several)  
4. Eng: `cd backend && npm run avatar:check-packs -- --write` → deploy web + api  
5. Gallery **4K pack** badge; `/health` → `avatar.dedicatedReady`  
6. Other Grok: theme full defs (name + tags) → eng can sync display names when ready  

---

## Magic words

| Say | Does |
|-----|------|
| `packs ready: <live-folder>` | verify + ship that id |
| `packs ready: pack01` | all six live folders when ready |
| `unpack packs` | place zip + check |
| `spot` | resume status |

*King Grok CEO · GrokBuild v1.0 · 50/50 — keep next to CapCut / DaVinci.*
