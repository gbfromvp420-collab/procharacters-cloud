/**
 * Studio Forge v3 — expand natural language fantasy → Naughty Syntax DNA.
 * Uses xAI when configured; heuristic fallback always available (<5s).
 */

import { env } from "../../config/env.js";
import { XaiApiError, XaiChatClient } from "../llm/xai-client.js";
import { isSignatureModelId } from "./custom-characters.js";
import {
  forgeSystemPrompt,
  heuristicForgeExpand,
  parseLlmForgeJson,
  type ForgeExpandInput,
  type ForgeExpandResult,
  type NaughtySyntaxDna,
} from "./forge-dna.js";

function isRealXaiKey(key?: string): boolean {
  if (!key?.trim()) return false;
  const k = key.trim().toLowerCase();
  return (
    k !== "your_xai_api_key_here" &&
    k !== "changeme" &&
    k !== "xai-..." &&
    k.length > 12
  );
}

export type { ForgeExpandInput, ForgeExpandResult, NaughtySyntaxDna };
export {
  assembleDnaCharacterPrompt,
  dnaPresenceDefaults,
  dnaStarterLine,
  formatDnaMemorySeedsBlock,
  formatDnaSessionSeed,
  heuristicForgeExpand,
  pickBandFromDnaSentiment,
  pickClipFromDnaIntensity,
} from "./forge-dna.js";

export async function expandFantasyToDna(
  input: ForgeExpandInput,
): Promise<ForgeExpandResult> {
  const t0 = Date.now();
  const fantasy = input.fantasy?.trim() ?? "";
  if (fantasy.length < 8) {
    throw new Error("Fantasy text too short — describe the character (min 8 chars)");
  }
  if (fantasy.length > 4000) {
    throw new Error("Fantasy text too long (max 4000 chars)");
  }

  if (input.baseModelId && !isSignatureModelId(input.baseModelId)) {
    throw new Error(`Unknown base model '${input.baseModelId}'`);
  }

  let result: ForgeExpandResult;

  if (isRealXaiKey(env.XAI_API_KEY)) {
    try {
      const client = new XaiChatClient({
        apiKey: env.XAI_API_KEY!,
        model: env.XAI_MODEL,
        baseUrl: env.XAI_BASE_URL,
        maxCompletionTokens: Math.min(env.XAI_MAX_COMPLETION_TOKENS, 1200),
        temperature: 0.9,
        timeoutMs: 12_000,
      });

      const userParts = [
        `Fantasy:\n${fantasy}`,
        input.baseModelId ? `Preferred baseModelId (clips): ${input.baseModelId}` : "",
        input.displayNameHint ? `Name hint: ${input.displayNameHint}` : "",
        input.audience && input.audience !== "any"
          ? `Audience framing: ${input.audience}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const raw = await client.complete([
        { role: "system", content: forgeSystemPrompt() },
        { role: "user", content: userParts },
      ]);
      result = parseLlmForgeJson(raw, input);
    } catch (err) {
      // Timeout / API issues → still deliver forge under 5s via heuristic
      if (err instanceof XaiApiError || err instanceof Error) {
        console.warn("[forge-expand] LLM failed, heuristic fallback:", err.message);
      }
      result = heuristicForgeExpand(input);
    }
  } else {
    result = heuristicForgeExpand(input);
  }

  // Ensure base is valid
  if (!isSignatureModelId(result.form.baseModelId)) {
    result.form.baseModelId = input.baseModelId || "twink-default";
    result.dna.baseModelId = result.form.baseModelId;
  }

  result.dna.expandMs = Date.now() - t0;
  return result;
}
