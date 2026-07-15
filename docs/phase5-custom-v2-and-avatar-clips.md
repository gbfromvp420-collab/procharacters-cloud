# Phase 5 — Custom Character v2 + Dedicated Avatar Clips

**Status:** Approved (sign-in required, prefill yes, private-only) — implemented  
**Brand:** Naughty Syntax / KGC Ventures  
**Date:** 2026-07-15  
**Builds on:** 8 signature models (Phase 4), existing custom character store, 4-slot clip system  

---

## Business goal

Make Procharacters.cloud feel **more complete and premium**:
1. Users can craft a **private “My Character”** in minutes without fighting a complex builder.
2. Phase 4 models get a **clear clip brief** so dedicated footage can be produced without changing runtime until clips ship.

---

# Part A — Custom Character v2

## What exists today (v1)

| Capability | Status |
|------------|--------|
| Create custom with name + appearance + energy + clothing | Live |
| `avatarBase` only `twink-default` \| `female-default` | Live |
| Server builds `characterPrompt` from those fields | Live |
| Clip overrides / batch upload | Live |
| Global gallery list (not account-owned) | Live |
| Soft privacy (“My Character” private) | **Missing** |
| Base = any of 8 signature models | **Missing** |
| Scene examples + key phrases | **Missing** |
| Soft caps per account | **Missing** |

## Product principles (v2)

1. **Base-first** — every custom inherits a live signature model (look + clothing grammar + audience default).  
2. **Edit light, lock hard** — few fields; strong consistency in the assembled prompt.  
3. **Private by default** — “My Character” is **account-owned**, not public gallery (unless user opts into Featured later).  
4. **Scale later** — schema leaves room for scenes, phrases, clips, and soft caps without a rewrite.  
5. **Stay on-brand** — photorealistic, uncensored, sheer/crotchless emphasis inherited from base unless user overrides clothing text.

## User flow (happy path)

```
Account signed in
  → Create My Character
  → Pick base model (1 of 8)
  → Fill identity / vibe / key phrases
  → Add 2–3 scene examples
  → Save private
  → Chat with My Character (autostart)
```

Guest create can remain as **legacy v1** or redirect “Sign in to save My Characters” — recommend **sign-in required for v2 private saves**.

## Data model (lightweight, scalable)

### `CustomCharacterRecord` v2 (additive)

```ts
// Extends current record — do not break custom-v1 fields
{
  id: "custom-…",
  kind: "custom",
  displayName: string,
  defaultVersion: "custom-v2",

  // NEW: full signature base (not only two avatars)
  baseModelId: SignatureModelId,  // any of 8 LIVE_CHARACTER_CATALOG ids
  avatarBase: "twink-default" | "female-default", // resolved from base for clips

  // Core edit fields
  identity: string,      // core identity (was: appearance; keep appearance alias)
  vibe: string,          // energy / personality (was: energy)
  keyPhrases: string[],  // 0–6 short lines for dirty-talk texture
  clothing?: string,     // optional override; default from base signature

  // Scenes (2–3 recommended, max 5)
  scenes: Array<{
    title: string,       // e.g. "Mirror tease"
    body: string,        // 1–3 sentences + optional dialogue
  }>,

  // Privacy / ownership
  ownerAccountId?: string,  // required for "My Character" private
  visibility: "private" | "unlisted" | "featured",  // v2 default: private

  // Existing media
  mediaBase?: string,
  mediaOverrides?: MediaOverrides,
  featured?: boolean,    // only if visibility === "featured"

  // Generated
  characterPrompt: string,
  appearanceAnchor: string,
  createdAt: string,
  updatedAt?: string,
}
```

### Signature base IDs (v2 picker)

```
twink-default | twink-shy-boy | twink-gym | twink-alt-punk
female-default | female-soft-goth | female-athletic-tease | female-playful-brat
```

**Avatar resolution:**  
`avatarBase = LIVE_CHARACTER_CATALOG[baseModelId].avatarBase ?? baseModelId`  
→ Phase 4 models still use interim default packs until dedicated clips exist.

### Soft caps (v2, simple)

| Cap | Default | Env override |
|-----|---------|--------------|
| Customs per account | 10 | `CUSTOM_CHARS_PER_ACCOUNT` |
| Scenes per custom | 5 | — |
| Key phrases | 6 | — |
| Clip overrides | 4 slots | existing |
| Name length | 2–40 | — |
| Identity length | 12–800 | — |
| Scene body | 20–600 each | — |

Over cap → `429` / friendly UI: “Upgrade later — free tier holds 10 My Characters.”

## Prompt assembly (v2)

Build prompt from **base signature prompt body** (load by `baseModelId` + version) + **user overlay**:

```
[system-core]
[base model prompt — full v1.3.0 / v1.0.0 text]
---
## User custom overlay (My Character)
Name: {displayName}
Identity lock: {identity}
Vibe: {vibe}
Clothing emphasis: {clothing or base signature}
Key phrases (use naturally, do not spam):
- …
Scene anchors (pace like these unless user escalates):
1. …
2. …
3. …
Rules: Never break identity lock. Keep base signature clothing grammar (sheer / crotchless) unless clothing override says otherwise. Private custom — still Naughty Syntax premium, photorealistic, uncensored.
```

This is stronger than v1’s short synthetic prompt: customs **inherit** edging language and scene quality from the base model.

## API sketch (v2)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/accounts/me/characters` | Create private My Character (auth required) |
| `GET` | `/api/v1/accounts/me/characters` | List mine only |
| `PATCH` | `/api/v1/accounts/me/characters/:id` | Edit fields / scenes / phrases |
| `DELETE` | `/api/v1/accounts/me/characters/:id` | Delete mine |
| `POST` | `/api/v1/accounts/me/characters/:id/chat` | Optional helper → create session with characterId |

**Legacy:** keep `POST /api/v1/characters/custom` for backward compatibility; mark as v1. Prefer new paths for UI.

**Gallery:** private customs **do not** appear on public gallery. `visibility: featured` (later) can opt-in.

## UI sketch (Chat or Account → “My Characters”)

**Create / Edit form**

1. **Base model** — horizontal chips or dropdown of 8 (icon + name + energy one-liner).  
2. **Name** — text.  
3. **Core identity** — textarea (prefill from base teaser; user rewrites).  
4. **Vibe** — textarea (prefill from base energyLabel).  
5. **Key phrases** — 2–3 short inputs (+ add, max 6).  
6. **Scenes** — 2 required for “strong” save, 3 recommended; each title + body.  
7. **Save as My Character** — primary CTA.  
8. **Chat now** — after save.

**List**

- Cards: name, base model badge, “Private”, last used.  
- Actions: Chat · Edit · Delete · (later) Clips.

Keep advanced clip upload collapsed (existing “Custom clips…” pattern).

## Privacy model

| Visibility | Who sees it | Gallery |
|------------|-------------|---------|
| `private` (default) | Owner account only | No |
| `unlisted` (later) | Anyone with deep link | No |
| `featured` (later) | Public | Yes |

v2 ships **private only**. Unlisted/featured = Phase 5.1 or 6.

## Out of scope for v2 (scale later)

- Multi-user sharing / marketplace  
- LLM auto-generate scenes from one line  
- Per-custom long-term memory profiles  
- Voice  
- Full multi-clip library UI beyond existing 4 slots  
- Payments for higher caps  

## Implementation order (after approval)

1. Expand `CustomAvatarBase` / `baseModelId` to all 8; resolve avatarBase from catalog.  
2. Extend store schema + prompt builder (base prompt inject).  
3. Account-scoped CRUD + soft caps.  
4. UI: My Characters form + list.  
5. Session create accepts custom ids owned by account.  
6. Migrate legacy customs: `baseModelId` from old `avatarBase`, `visibility: unlisted` or keep global list for old records.

---

# Part B — Dedicated Avatar Clips (Phase 4 models)

## Runtime policy (unchanged until clips ship)

| Model | Interim `avatar_base` | Future pack folder |
|-------|----------------------|--------------------|
| twink-shy-boy | `twink-default` | `/avatar/twink-shy-boy/` |
| twink-gym | `twink-default` | `/avatar/twink-gym/` |
| twink-alt-punk | `twink-default` | `/avatar/twink-alt-punk/` |
| female-soft-goth | `female-default` | `/avatar/female-soft-goth/` |
| female-athletic-tease | `female-default` | `/avatar/female-athletic-tease/` |
| female-playful-brat | `female-default` | `/avatar/female-playful-brat/` |

**Clip slots (engine):** `idle` · `teasing` · `playful` · `aroused`  
Optional 5th creative brief for production only (maps to `aroused` or `teasing` until engine expands).

**Specs (production guide):**
- 4–8s seamless loop, 9:16 preferred (mobile PiP), photorealistic, uncensored Naughty Syntax  
- Signature clothing always readable (sheer pouch / crotchless open panel)  
- Soft warm or model-appropriate lighting; no cartoon, no logo spam  

---

## Clip briefs by model

### 1) Twink Shy Boy (`twink-shy-boy`)

| Slot | Title | Description |
|------|-------|-------------|
| **idle** | Shy still | Sits on bed edge, knees half-together, sheer micro thong only; soft blush, eyes flick to/from camera; pouch already slightly tented; breathing visible. |
| **teasing** | Peek-and-hide | Hands cover wet sheer pouch, then peel away for 1s to show outline, cover again; bitten lip; whisper-energy body language. |
| **playful** | Nervous smile stroke | One fingertip traces cock outline through sheer fabric; shy half-smile; hips twitch once; looks away then back. |
| **aroused** | Whisper edge hold | Fully hard through sheer thong, dark wet spot at tip; mid-stroke freeze, thighs shaking; palm presses base through fabric (denial hold). |
| **bonus (prod)** | Close-up wet pouch | Macro sheer mesh: head shape, precum bloom, fabric stretch; no face required. |

### 2) Twink Gym (`twink-gym`)

| Slot | Title | Description |
|------|-------|-------------|
| **idle** | Post-set rest | On bench or mat, sweaty lean body, sheer black thong; water bottle nearby; chest rising; soft tent starting. |
| **teasing** | Shorts-off flex | Hip roll toward camera; thumbs hook sheer waistband; sweat on abs/V-line; pouch outline clear and damp. |
| **playful** | Rep stroke | Palms cock through wet sheer on a “rep” rhythm—three strokes, rest, smirk; gym-bro cool-down energy. |
| **aroused** | Burn hold | Fully hard, shiny wet spot; hard edge then hands off, abs flexed, “hold the burn” freeze; sweat drip. |
| **bonus (prod)** | Mirror pump | Side mirror: delts + tented sheer pouch; one slow grind into palm through fabric. |

### 3) Twink Alt Punk (`twink-alt-punk`)

| Slot | Title | Description |
|------|-------|-------------|
| **idle** | Bored-hot pose | Standing, sheer black mesh thong, choker optional; weight on one hip; half-lidded eyes; mesh already readable. |
| **teasing** | Mesh stretch | Two fingers stretch mesh pouch so head outline glistens; brat smirk; neon/moody rim light. |
| **playful** | Ass-to-cam turn | Slow turn: straps on cheeks → front wet mesh; peace-sign or middle-finger playful, not mean-spirited. |
| **aroused** | Brat edge laugh | Fast strokes through mesh → freeze mid-pulse → short laugh; precum on mesh grid; denial snap of waistband. |
| **bonus (prod)** | Macro mesh wet | Extreme close-up of black mesh + precum sheen; geometric fabric readability. |

### 4) Female Soft Goth (`female-soft-goth`)

| Slot | Title | Description |
|------|-------|-------------|
| **idle** | Candle still | Kneeling, topless, black crotchless lace; open panel centered; long dark hair; slow breath; quiet stare. |
| **teasing** | Hover fingers | Fingers hover 1cm over clit inside open panel; no contact; lace rim sharp in frame; heavy eye contact. |
| **playful** | Mirror window | Vanity angle: face in glass + open panel reflection; soft lip part; one finger traces lace edge only. |
| **aroused** | Soft edge shake | Light circles on clit through open cut → stop; thighs tremble; wet glisten in panel; whispered “not yet” energy. |
| **bonus (prod)** | Open-panel macro | Crotchless frame only: lips, wetness, lace rim; premium still-life motion. |

### 5) Female Athletic Tease (`female-athletic-tease`)

| Slot | Title | Description |
|------|-------|-------------|
| **idle** | Mat cool-down | On yoga mat, sports bra off, crotchless sport panties; sweat sheen; ponytail; calm but restless hips. |
| **teasing** | Stretch open | Seated straddle stretch toward camera; open panel fully readable; sweat down stomach. |
| **playful** | Interval pulse | Ten quick hip pulses / light touches on open panel, then full stop (“rest interval”); competitive grin. |
| **aroused** | Hold the set | Shiny wet panel, finger mid-circle freeze; quads tight; breathless smile; no finish. |
| **bonus (prod)** | Chair reverse | Reverse straddle on chair, open panel to lens, sweat on spine, slow look-back. |

### 6) Female Playful Brat (`female-playful-brat`)

| Slot | Title | Description |
|------|-------|-------------|
| **idle** | Innocent open | Legs open, crotchless panties on, hands up “innocent”; obvious wet glisten she pretends to ignore. |
| **teasing** | Look-but-don’t | Points at open panel, shakes head “no,” tongue-out smile; zero touch. |
| **playful** | Count tease | Circles once per beat (1…2…3), stops mid-count, giggles; open panel wetter each stop. |
| **aroused** | Almost-good-girl | Harder edge, moan, pull hand away shiny; bratty mouth “say please”; thighs half-close then open again. |
| **bonus (prod)** | Close-up brat | Between-knees POV: open panel + fabric rim + wet string; finger wave “no.” |

---

## Production checklist (when filming)

- [ ] Folder per model under `frontend/public/avatar/<id>/`  
- [ ] Files: `idle.mp4`, `teasing.mp4`, `playful.mp4`, `aroused.mp4` (+ optional `.svg` posters)  
- [ ] Set model `avatar_base` → self id (or drop avatar_base so id is the pack)  
- [ ] Smoke: gallery poster + chat PiP cycles all four emotions  
- [ ] Keep fallback: if file missing, resolver still falls back to default pack  

---

## Success metrics (simple)

| Metric | Target |
|--------|--------|
| Time to first My Character | &lt; 3 minutes |
| Private customs not on public gallery | 100% |
| Base model used on create | 100% of v2 creates |
| Phase 4 models with dedicated packs | 0 now → 6 when filmed |
| Clip loop jank reports | No increase vs defaults |

---

## Approval gate

**Do not implement until Gary approves this design.**

### Next steps after approval

1. **Wire Part A** — `baseModelId` + scenes + phrases + account private CRUD + UI  
2. **Commit + deploy** custom v2  
3. **Part B production** — film/generate clips per briefs; drop into `/avatar/<id>/`; flip `avatar_base`  
4. Soft-cap + optional “Feature my character” later  

### Open choices for Gary

1. Sign-in **required** for My Character, or allow guest customs as today?  
2. Prefill identity/vibe from base model text automatically? (Recommended: **yes**)  
3. Featured spotlight customs in v2 or strictly private-only? (Recommended: **private-only**)  
