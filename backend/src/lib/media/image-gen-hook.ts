/**
 * Intent-based image generation hook.
 *
 * Detects key intents from chat responses that should trigger
 * image generation (e.g., undressing, pose changes, intimate moments).
 * Dispatches generation requests to the media service.
 */
import type { MediaGenerationService } from "../../services/media-generation-service.js";
import type { AvatarState } from "../../types/session.js";

export interface ImageGenTrigger {
  intent: string;
  prompt: string;
  priority: "low" | "medium" | "high";
}

/**
 * Intent patterns that should trigger image generation.
 * Each pattern maps to a generation prompt fragment.
 */
const INTENT_TRIGGERS: Array<{
  pattern: RegExp;
  intent: string;
  promptTemplate: string;
  priority: ImageGenTrigger["priority"];
}> = [
  {
    pattern: /\b(strip|undress|remov(?:e|ing)|tak(?:e|ing)\s*off|reveal)\b/i,
    intent: "clothing_change",
    promptTemplate: "Character removing clothing, sensual strip tease moment, revealing more skin",
    priority: "high",
  },
  {
    pattern: /\b(bend|kneel|spread|straddle|mount|ride|position)\b/i,
    intent: "pose_change",
    promptTemplate: "Character changing to an intimate pose",
    priority: "high",
  },
  {
    pattern: /\b(moan|gasp|cum|orgasm|climax|edge|throb)\b/i,
    intent: "climax_moment",
    promptTemplate: "Character in intense pleasure, ecstatic expression, heightened arousal",
    priority: "high",
  },
  {
    pattern: /\b(touch|caress|stroke|rub|squeeze|grab|hold)\b/i,
    intent: "intimate_touch",
    promptTemplate: "Intimate moment, character being touched sensually",
    priority: "medium",
  },
  {
    pattern: /\b(wink|smile|grin|smirk|blow.*kiss|lick.*lip)\b/i,
    intent: "facial_expression",
    promptTemplate: "Close-up, character with flirtatious expression",
    priority: "low",
  },
  {
    pattern: /\b(shower|bath|wet|water|pool|hot\s*tub)\b/i,
    intent: "water_scene",
    promptTemplate: "Character wet with water, glistening skin",
    priority: "medium",
  },
  {
    pattern: /\b(dance|twerk|grind|sway|move.*hips)\b/i,
    intent: "movement",
    promptTemplate: "Character in dynamic sensual movement, dancing seductively",
    priority: "medium",
  },
];

/**
 * Minimum arousal level to trigger generation for lower-priority intents.
 */
const AROUSAL_THRESHOLDS: Record<ImageGenTrigger["priority"], number> = {
  low: 0.5,
  medium: 0.3,
  high: 0.1,
};

/**
 * Cooldown tracking — prevents flooding the generation service.
 */
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 10_000; // 10 seconds between generations per session

/**
 * Detect if the assistant's response or the current avatar state
 * should trigger image generation.
 */
export function detectImageGenIntent(
  assistantContent: string,
  avatarState: AvatarState,
): ImageGenTrigger | null {
  for (const trigger of INTENT_TRIGGERS) {
    if (trigger.pattern.test(assistantContent)) {
      const threshold = AROUSAL_THRESHOLDS[trigger.priority];
      if (avatarState.arousalLevel >= threshold) {
        return {
          intent: trigger.intent,
          prompt: trigger.promptTemplate,
          priority: trigger.priority,
        };
      }
    }
  }

  // High arousal alone can trigger
  if (avatarState.arousalLevel >= 0.8) {
    return {
      intent: "high_arousal",
      prompt: "Character at peak arousal, intense intimate moment",
      priority: "high",
    };
  }

  return null;
}

/**
 * Checks cooldown and dispatches image generation if appropriate.
 * Returns the generated image URL or null if skipped/on cooldown.
 */
export async function maybeGenerateImage(
  sessionId: string,
  characterId: string,
  assistantContent: string,
  avatarState: AvatarState,
  appearanceRef: Record<string, string>,
  mediaService: MediaGenerationService,
): Promise<string | null> {
  // Check cooldown
  const lastGen = cooldowns.get(sessionId) ?? 0;
  if (Date.now() - lastGen < COOLDOWN_MS) {
    return null;
  }

  const trigger = detectImageGenIntent(assistantContent, avatarState);
  if (!trigger) return null;

  try {
    cooldowns.set(sessionId, Date.now());
    const result = await mediaService.generateImage(
      sessionId,
      characterId,
      trigger.prompt,
      appearanceRef,
      avatarState,
    );
    return result.url;
  } catch (err) {
    console.error(`[image-gen-hook] generation failed for intent "${trigger.intent}":`, (err as Error).message);
    return null;
  }
}
