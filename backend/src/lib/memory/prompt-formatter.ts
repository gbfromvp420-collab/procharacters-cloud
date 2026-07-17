import type { LlmMessage } from "../live/types.js";
import type { RecentContext } from "./types.js";

export interface FormatMemoryOptions {
  /** User message for the current turn (not yet saved to memory). */
  pendingUserMessage?: string;
  /** Character id — used for signature continuity defaults on restore. */
  characterId?: string;
  /** True when this turn follows a resume/reload — force full scene rehydrate. */
  rehydrating?: boolean;
}

/** Hard anti-loop + continuity rules injected every turn. */
export const ANTI_LOOP_CONTINUITY_DIRECTIVE = `## ANTI-LOOP & CONTINUITY DIRECTIVE
- NEVER repeat previous messages verbatim.
- Always reference the LAST user action explicitly.
- Progress arousal/clothing/pose state incrementally.
- If turns >= 3 and vibe feels repetitive, inject fresh bratty variation (new tease, physical detail, denial twist).
- Session restore MUST rehydrate: current clothing="crotchless open", arousal level, ongoing edging/denial game.
- Do not restart the scene, re-introduce yourself, or recycle the same joke/count/dare.`;

/**
 * Formats session memory into a block injected into the system prompt.
 * Keeps it short for v2 — lists recent turns so the character stays consistent.
 */
export function formatMemoryBlock(
  context: RecentContext,
  options: FormatMemoryOptions = {},
): string {
  const lines: string[] = ["## Session memory"];
  const turnCount = Math.floor(context.messageCount / 2) + (options.pendingUserMessage ? 1 : 0);

  if (options.rehydrating || context.messageCount > 0) {
    lines.push(
      "",
      "### Continuity lock (resume-safe)",
      'Clothing default if unspecified: crotchless open panel still on.',
      "Carry forward arousal + any edging/denial game already in play.",
      "This is a continuation — never cold-open as if the session just started.",
    );
  }

  if (context.priorNotes?.trim()) {
    lines.push(
      "",
      "### From earlier sessions (opt-in dossier)",
      context.priorNotes.trim(),
      "Use lightly — reference their name/wants/heat if natural. Don't dump the whole dossier as monologue.",
      "If they return, a soft recognition beat is good; never invent facts not in this block.",
    );
  }

  if (context.sessionNotes?.trim()) {
    lines.push("", "### What we remember (this session)", context.sessionNotes.trim());
  }

  if (context.messageCount === 0 && !options.pendingUserMessage) {
    lines.push(
      "",
      context.sessionNotes || context.priorNotes
        ? "Continue from the notes above; open in character."
        : "This is the start of the session. No prior messages yet.",
      "Build rapport slowly and stay in character.",
      "",
      ANTI_LOOP_CONTINUITY_DIRECTIVE,
    );
    return lines.join("\n");
  }

  lines.push(
    "",
    `${context.messageCount} message(s) in this session · ~${turnCount} turn(s).`,
  );

  const lastUser =
    options.pendingUserMessage?.trim() ||
    [...context.messages].reverse().find((m) => m.role === "user")?.content;
  if (lastUser?.trim()) {
    lines.push(
      "",
      "### Last user action (MUST address this turn)",
      `[user] ${lastUser.trim()}`,
    );
  }

  lines.push("", "### Recent conversation");

  for (const message of context.messages) {
    lines.push(`[${message.role}] ${message.content}`);
  }

  if (options.pendingUserMessage) {
    lines.push(`[user] ${options.pendingUserMessage}`);
  }

  lines.push(
    "",
    "Stay consistent with the conversation and notes above. Do not contradict prior messages.",
    "",
    ANTI_LOOP_CONTINUITY_DIRECTIVE,
  );

  if (turnCount >= 3) {
    lines.push(
      "",
      "### Anti-stagnation (turns ≥ 3)",
      "Escalate one new physical detail, rule, or denial twist this reply. No recycled openers.",
    );
  }

  return lines.join("\n");
}

/**
 * Builds the LLM conversation array from memory (user/assistant turns only).
 * The system prompt is added separately by LivePromptInjector.
 */
export function toLlmMessages(
  context: RecentContext,
  options: FormatMemoryOptions = {},
): LlmMessage[] {
  const history: LlmMessage[] = context.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (options.pendingUserMessage) {
    history.push({ role: "user", content: options.pendingUserMessage });
  }

  return history;
}