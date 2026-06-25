export const SYSTEM_CORE_PROMPT_PATH =
  "prompts/library/naughty-syntax/system-core/v1.0.0/prompt.md";

export const DEFAULT_PROMPT_VERSION = "v1.2.0";

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

Keep avatar_intent values consistent with your character's signature look and energy.
`.trim();