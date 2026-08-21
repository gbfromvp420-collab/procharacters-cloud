import type { AvatarState } from "../../types/session.js";

export interface ParsedGrokReply {
  /** Text shown in chat (avatar JSON block stripped). */
  text: string;
  avatarIntent?: Partial<AvatarState>;
}

/**
 * Strips avatar_intent JSON from Grok replies and maps it into AvatarState.
 * Tolerant: trailing fence, any fence, or bare trailing object.
 */
export function parseGrokReply(raw: string): ParsedGrokReply {
  if (!raw?.trim()) return { text: "" };

  // Prefer last fenced ```json ... ``` (Grok usually ends with it)
  const fenceGlobal = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (let i = fenceGlobal.length - 1; i >= 0; i--) {
    const block = fenceGlobal[i]![1]?.trim();
    if (!block) continue;
    const intent = extractAvatarIntent(block);
    if (intent) {
      const text = stripFenceAt(raw, fenceGlobal[i]!.index!).trim();
      return { text: text || raw.trim(), avatarIntent: intent };
    }
  }

  // Bare JSON object near the end containing avatar_intent
  const bare = raw.match(/(\{[\s\S]*"avatar_intent"[\s\S]*\})\s*$/i);
  if (bare) {
    const intent = extractAvatarIntent(bare[1]!);
    if (intent) {
      const text = raw.slice(0, bare.index).trim();
      return { text: text || raw.trim(), avatarIntent: intent };
    }
  }

  return { text: raw.trim() };
}

function stripFenceAt(raw: string, index: number): string {
  // Remove from the fence start to end of that fence block
  const fromFence = raw.slice(index);
  const closed = fromFence.match(/^```(?:json)?\s*[\s\S]*?\s*```/i);
  if (closed) {
    return raw.slice(0, index) + fromFence.slice(closed[0].length);
  }
  return raw.slice(0, index);
}

function extractAvatarIntent(jsonText: string): Partial<AvatarState> | undefined {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const intentRaw =
      (parsed.avatar_intent as Record<string, unknown> | undefined) ??
      (parsed.avatarIntent as Record<string, unknown> | undefined);
    if (!intentRaw || typeof intentRaw !== "object") return undefined;

    const emotion = asString(intentRaw.emotion);
    const pose = asString(intentRaw.pose);
    const action = asString(intentRaw.action);
    const clothing = asString(intentRaw.clothing_state) ?? asString(intentRaw.clothingState);
    const arousal = asNumber(intentRaw.arousal_level) ?? asNumber(intentRaw.arousalLevel);

    if (!emotion && !pose && !action && arousal === undefined && !clothing) {
      return undefined;
    }

    return {
      ...(emotion ? { emotion } : {}),
      ...(pose ? { pose } : {}),
      ...(action ? { action } : {}),
      ...(arousal !== undefined ? { arousalLevel: arousal } : {}),
      ...(clothing ? { clothingState: clothing } : {}),
    };
  } catch {
    return undefined;
  }
}

function asString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(1, Math.max(0, v));
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  }
  return undefined;
}
