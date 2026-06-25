import type { AvatarState } from "../../types/session.js";

export interface ParsedGrokReply {
  /** Text shown in chat (avatar JSON block stripped). */
  text: string;
  avatarIntent?: Partial<AvatarState>;
}

/**
 * Strips the trailing ```json avatar_intent block from Grok replies.
 * Returns clean chat text + optional avatar state for the video layer.
 */
export function parseGrokReply(raw: string): ParsedGrokReply {
  const jsonBlockMatch = raw.match(/```json\s*([\s\S]*?)\s*```\s*$/i);

  if (!jsonBlockMatch) {
    return { text: raw.trim() };
  }

  const text = raw.slice(0, jsonBlockMatch.index).trim();
  let avatarIntent: Partial<AvatarState> | undefined;

  try {
    const parsed = JSON.parse(jsonBlockMatch[1]) as {
      avatar_intent?: {
        emotion?: string;
        pose?: string;
        action?: string;
        arousal_level?: number;
        clothing_state?: string;
      };
    };

    const intent = parsed.avatar_intent;
    if (intent) {
      avatarIntent = {
        emotion: intent.emotion ?? "teasing",
        pose: intent.pose ?? "idle",
        action: intent.action ?? "subtle_movement",
        arousalLevel:
          typeof intent.arousal_level === "number" ? intent.arousal_level : undefined,
        clothingState: intent.clothing_state,
      };
    }
  } catch {
    // Keep chat text even if JSON parse fails
  }

  return { text: text || raw.trim(), avatarIntent };
}