import type { LlmMessage } from "../live/types.js";
import type { RecentContext } from "./types.js";

export interface FormatMemoryOptions {
  /** User message for the current turn (not yet saved to memory). */
  pendingUserMessage?: string;
}

/**
 * Formats session memory into a block injected into the system prompt.
 * Keeps it short for v2 — lists recent turns so the character stays consistent.
 */
export function formatMemoryBlock(
  context: RecentContext,
  options: FormatMemoryOptions = {},
): string {
  if (context.messageCount === 0 && !options.pendingUserMessage) {
    return [
      "## Session memory",
      "This is the start of the session. No prior messages yet.",
      "Build rapport slowly and stay in character.",
    ].join("\n");
  }

  const lines: string[] = [
    "## Session memory",
    `${context.messageCount} message(s) in this session.`,
    "",
    "### Recent conversation",
  ];

  for (const message of context.messages) {
    lines.push(`[${message.role}] ${message.content}`);
  }

  if (options.pendingUserMessage) {
    lines.push(`[user] ${options.pendingUserMessage}`);
  }

  lines.push(
    "",
    "Stay consistent with the conversation above. Do not contradict prior messages.",
  );

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