# 4K pack cheat sheet (Gary)

Quick cut + package guide. Full detail: [GARY-PACK-EDITING.md](./GARY-PACK-EDITING.md) · drop-in: `frontend/public/avatar/packs/DROP_IN.md`

---

## Folder names

**Don’t:** `Anna4kpack`, spaces, mixed case, “4k” in the name.

**Do:**

| Track | Layout |
|-------|--------|
| Live Phase 4 models | `frontend/public/avatar/<model-id>/` |
| Your library (later) | one folder per character, lowercase + hyphens (`anna-soft`, `diego-mesh`) |

### Phase 4 model IDs (ship these first)

| Folder | Vibe |
|--------|------|
| `female-playful-brat` | brat / almost-good-girl |
| `twink-gym` | post-set / flex / burn |
| `female-soft-goth` | soft candle / hover / edge |
| `twink-shy-boy` | shy still / peek / nervous |
| `female-athletic-tease` | mat cool-down / stretch / hold |
| `twink-alt-punk` | bored-hot / mesh / brat edge |

Match **vibe**, not real names. “Anna” playful → `female-playful-brat`.

---

## Files (only these)

```
idle.mp4
teasing.mp4
playful.mp4
aroused.mp4
```

| | |
|--|--|
| Required | **4 MP4s only** |
| Optional | SVG posters — **not** needed for pack ready |
| Codec | H.264 `.mp4` |
| Aspect | **9:16** preferred (1:1 ok) |
| Res | 1080×1920 ideal; 720×1280 fine |
| Audio | off is fine |

Exact names, case-sensitive.

---

## Stage 0 (optional) — prime extract from long takes

From a folder of long source videos:

```bash
cd /path/to/your/sources
IN_DIR=. OUT_DIR=./new_chars_batch DURATION=25 MAX_CHARS=10 \
  bash /path/to/procharacters-cloud/scripts/extract-prime-clips.sh
```

Gives one ~25s prime per file. **Then** cut each prime into the 4 engine slots below (product does **not** play 25s primes as avatar bands).

### Stage 2 — prime → 4 engine loops (ffmpeg) · v2

```bash
# Preferred:
bash scripts/cut-loops.sh ./new_chars_batch/foo_prime_25s.mp4 female-playful-brat

# Alias (same script):
bash scripts/prime-to-pack-loops.sh ./new_chars_batch/foo_prime_25s.mp4 female-playful-brat

# Tweak starts/lengths per character
OFFSETS='2 8 14 20' DURATIONS='6 5 7 5' \
  bash scripts/cut-loops.sh ./primes/gym_prime_25s.mp4 twink-gym

# Optional force 9:16 1080×1920 (pad):
SCALE_9_16=1 bash scripts/cut-loops.sh ./primes/x_prime_25s.mp4 twink-shy-boy
```

Defaults: offsets `0 6 12 18`, durations `6 5 7 5`, fade **0.4s**, CRF **22**, silent H.264, even dims.  
Outputs `packs/<model-id>/{idle,teasing,playful,aroused}.mp4`.  
Then: `cp packs/<id>/*.mp4 frontend/public/avatar/<id>/` → **`packs ready: <id>`**

Manual CapCut still fine if you prefer eye-cut energy marks.

## Edit each clip

| Slot | Feel | Length |
|------|------|--------|
| `idle` | calm, breathing, soft eye contact | **4–8s** (5–6s sweet) |
| `teasing` | flirt, fabric tug, almost-touch | **4–8s** |
| `playful` | motion, fun stroke/tease energy | **4–8s** |
| `aroused` | heat, edge-hold, don’t-stop | **4–8s** |

**Loop:** first frame ≈ last frame (no hard jump).  
**Fades:** optional — only if the cut jumps; soft **0.2–0.3s** at ends is enough.  
**Skip:** titles, logos, music, long cinematics.

One long take → mark 4 energy moments → export 4 shorts.

---

## Hand-off

1. Four files in the right folder  
2. Tell King Grok: **`packs ready: <id>`** (or zip + **`unpack packs`**)  
3. Eng: `cd backend && npm run avatar:check-packs -- --write` → deploy web + api  
4. Gallery shows green **4K pack**; `/health` → `avatar.dedicatedReady`

---

## Magic words

| Say | Does |
|-----|------|
| `packs ready: female-playful-brat` | verify + ship that id |
| `unpack packs` | place zip into folders + check |
| `spot` | resume status |

*King Grok CEO — keep this next to CapCut / DaVinci while you cut.*
