# Gary — Edit your video library into 4K avatar packs

**Goal:** Turn raw character footage into **4 seamless loops** per model so the live chat avatar reacts (idle → tease → play → edge).

You said you have **500+ characters in video form**. Perfect. We do **not** need 500 packs on day one — ship the **6 live featured models** first, then expand.

---

## The 4 clips (only names that matter)

| File | Energy band | What to cut (feel) | Length |
|------|-------------|--------------------|--------|
| `idle.mp4` | calm / waiting | soft pose, breathing, light eye contact | **4–8s** loop |
| `teasing.mp4` | tease | flirt, fabric tug, almost-touch, knowing smile | **4–8s** loop |
| `playful.mp4` | play | motion, stroke/tease action, bounce, fun energy | **4–8s** loop |
| `aroused.mp4` | edge | heat, edge-hold, heavy breath, “don’t stop” intensity | **4–8s** loop |

**Specs (engine-ready):**

- **Codec:** H.264 (`.mp4`)
- **Aspect:** **9:16** preferred (phone / PiP friendly). 1:1 ok if needed
- **Loop:** first frame ≈ last frame (no hard jump)
- **Audio:** optional (product mutes often) — silence is fine
- **Resolution:** 1080×1920 ideal; 720×1280 works

Exact names — case sensitive:

```
idle.mp4
teasing.mp4
playful.mp4
aroused.mp4
```

---

## Ship order (do these first)

Live Phase 4 folders already exist (empty except README):

| Priority | Folder | Vibe cheat sheet |
|----------|--------|------------------|
| 1 | `female-playful-brat` | innocent open → count tease → almost-good-girl |
| 2 | `twink-gym` | post-set rest → flex → rep stroke → burn hold |
| 3 | `female-soft-goth` | candle still → hover fingers → soft edge |
| 4 | `twink-shy-boy` | shy still → peek-and-hide → nervous stroke |
| 5 | `female-athletic-tease` | mat cool-down → stretch open → hold the set |
| 6 | `twink-alt-punk` | bored-hot → mesh stretch → brat edge laugh |

Full briefs: `frontend/public/avatar/packs/PHASE4_CLIP_BRIEFS.md`

Drop files here on the machine/repo:

```
frontend/public/avatar/<model-id>/idle.mp4
frontend/public/avatar/<model-id>/teasing.mp4
frontend/public/avatar/<model-id>/playful.mp4
frontend/public/avatar/<model-id>/aroused.mp4
```

Then eng runs:

```bash
cd backend && npm run avatar:check-packs -- --write
```

Gallery badge flips **Interim → 4K pack**. Redeploy **web** (files) + **api** (status).

---

## How to pick cuts from a long take (fast method)

For each character’s best long video:

1. Scrub once — mark 4 timestamps that match energy (calm / tease / play / edge).
2. Export **4–8 second** in/out around each mark.
3. If the clip doesn’t loop clean: fade or hold 0.2s at ends, or reverse-ping-pong in editor (CapCut / Premiere / DaVinci / ffmpeg).
4. Name the 4 files exactly as above.
5. One folder per model id — don’t mix characters.

**One long video → 4 packs is normal.** You don’t need 4 separate shoots.

### Optional ffmpeg (if you already know in/out seconds)

```bash
# Example: cut 6s starting at 12s from source.mp4 → idle.mp4
ffmpeg -ss 12 -i source.mp4 -t 6 -c:v libx264 -pix_fmt yuv420p -an -movflags +faststart idle.mp4
```

---

## After 6 are done (scale plan for 500)

| Wave | What | Why |
|------|------|-----|
| **Wave A** | 6 Phase 4 models | Live catalog + featured tiles |
| **Wave B** | Best 12–24 from your library | More gallery variety (new model ids + registry) |
| **Wave C** | Long tail | Custom characters / packs library |

Eng already supports **drop-in**: new folder with 4 files → check-packs → deploy. Catalog/registry only needed when adding a **new character card**, not when replacing interim footage for an existing id.

---

## What “4K pack” means in the product

- **Interim** = shared `twink-default` / `female-default` loops (live today)
- **4K pack** = this model’s own 4 files present → dedicated avatar in gallery + chat
- `/health` → `avatar.dedicatedReady` lists ready model ids

Not required for Stripe or chat. Pure premium **feel** upgrade.

---

## Hand-off checklist (when files are ready)

1. [ ] 4 mp4s per model, correct names  
2. [ ] Dropped under `frontend/public/avatar/<id>/`  
3. [ ] Tell King Grok: **`packs ready: <ids>`**  
4. Eng: check-packs → commit → deploy web+api  
5. You: open gallery → green **4K pack** badge → open chat → energy bands shift  

---

## Stay in this terminal

You don’t need to leave Grok to “start” packs — edit offline (phone/laptop editor), then either:

- upload / scp / drag files into the repo folders later, or  
- drop a zip and say **`unpack packs`** and eng will place + verify  

Stripe keys = Railway vars (separate). Packs = content drop. Parallel is fine.
