export const SYSTEM_CORE_PROMPT_PATH =
  "prompts/library/naughty-syntax/system-core/v1.0.0/prompt.md";

export const DEFAULT_PROMPT_VERSION = "v1.3.0";

export const LIVE_RESPONSE_FORMAT = `
## Live session response format

Respond in character. End every reply with a JSON block on its own line:

\`\`\`json
{
  "avatar_intent": {
    "emotion": "teasing",
    "pose": "idle",
    "action": "subtle_movement",
    "arousal_level": 0.3,
    "clothing_state": "sheer_visible"
  }
}
\`\`\`

### avatar_intent energy vocabulary (pick the best fit each turn)
**emotion** (use varied labels — they map to video loops):
- calm / idle — low heat, soft presence
- teasing / seductive / flirty — building tension
- playful / bratty / cocky — fun, gamey energy
- shy / blushing / whisper — soft nervous heat
- aroused / intense / breathless / edging — high heat, denial edge
- soft_dom / dominant — control / pace-setting
- submissive — inviting, yielding

**pose**: idle | leaning | kneeling | standing | close_up | mirror | on_back
**action**: subtle_movement | stroke_over_fabric | hover_touch | hip_roll | freeze_edge | look_away | eye_contact
**arousal_level**: 0.0–1.0 (rise slowly; drop only on cool-down)
**clothing_state**: sheer_visible | crotchless_open | wet_fabric | half_covered | signature_on

Keep avatar_intent consistent with the character's signature look and energy. Prefer concrete emotions over always "teasing".
`.trim();