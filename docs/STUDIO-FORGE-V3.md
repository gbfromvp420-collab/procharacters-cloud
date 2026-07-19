# Studio Forge Revolution — v3 Unchained

**Status:** Shipped eng (2026-07-19)  
**Surface:** `/models/studio`  
**Brand:** Naughty Syntax DNA

---

## What it is

Conversational character factory: user types a fantasy → backend expands into a full **Naughty Syntax DNA** bundle → live preview + save as private My Character → Chat Now.

Not a form-first builder. The primary input is natural language.

---

## DNA bundle (`NaughtySyntaxDna` v3.0)

| Layer | Purpose |
|-------|---------|
| **Adaptive prompt core v1.4+** | Identity lock + dark / chaotic / flirty branches + booster |
| **Behavior tree** | Session evolution nodes (spark → tease → edge → deny → release gate) |
| **LiveKit meta** | Intensity→band map, pose/expression per band, sentiment keywords |
| **Clip tags + transitions** | Auto-tag slots + escalate/cool/deny transition intelligence |
| **Memory seeds** | Cross-session obsession hooks (kink, ritual, name, boundary) |
| **Evolution vector** | power / intimacy / chaos / denial / pace |

On create with DNA → `defaultVersion: custom-v3` and `characterPrompt` assembled from adaptive core + branches.

### Live runtime (post-save → chat)

| Hook | Behavior |
|------|----------|
| **Session create** | DNA memory seeds + vibe/evolution → `priorNotes` / session notes (even without user dossier opt-in) |
| **Opening line** | `dna.starterLine` (or first key phrase) instead of generic custom template |
| **Presence / avatar defaults** | LiveKit band + evolution → emotion/pose/action/arousal + body hint |
| **Clip pick** | `livekit.intensityMap` when emotion/action map misses |
| **Session mode block** | Evolution denial/pace/power/chaos + behavior root each turn |
| **Adaptive prompt** | Behavior tree node list + evolution runtime + DNA seeds in character layer |

---

## API

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/v1/characters/forge/expand` | Body: `{ fantasy, baseModelId?, displayNameHint?, audience? }` → `{ dna, form, expandMs, source }` |
| `POST` | `/api/v1/characters/custom` | Accepts optional `dna` |
| `PATCH` | `/api/v1/characters/custom/:id` | Accepts `dna` / `null` |

**Expand source:** `llm` when `XAI_API_KEY` set (12s timeout); else / on failure → `heuristic` (always sub-second).

**Rate limit:** `RATE_LIMITS.forgeExpand` (default 30 / 15 min per IP).

**Metric:** `forgeExpands` on `/metrics`.

---

## Frontend

- Conversational hero on Studio (examples + ⌘/Ctrl+Enter)
- Next.js **Server Action** `forgeExpandAction` + REST fallback `forgeExpandFantasy`
- Canvas `ForgeAvatarComposer` intensity/band overlay
- Sentiment-aware preview band switching
- **Export DNA** JSON download
- Manual fields still available (advanced / edit)

---

## Performance target

Forge complete model **under 5 seconds** in the happy path (heuristic always; LLM when fast enough).

---

## Out of scope (still)

- Full WebGL 3D mesh composer
- Hard WS state-machine stepper for every behavior-tree edge (DNA tree is prompt + mode bias today)
- Marketplace / public DNA share

---

*King Grok CEO · Studio Forge v3 · 50/50*
