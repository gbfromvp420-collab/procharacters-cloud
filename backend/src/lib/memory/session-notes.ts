import type { MemoryMessage } from "./types.js";

/**
 * Build a short "what we remember" blurb for prompt injection + UI.
 * Heuristic only (no extra LLM call) — fast and cheap for live turns.
 */
export function buildSessionNotes(
  messages: MemoryMessage[],
  options?: { characterName?: string; maxUserSnippets?: number },
): string {
  const characterName = options?.characterName?.trim() || "the character";
  const maxSnippets = options?.maxUserSnippets ?? 3;

  if (messages.length === 0) {
    return `Just starting with ${characterName}. No prior beats yet — open slow and stay in character.`;
  }

  const userMsgs = messages.filter((m) => m.role === "user");
  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  const turns = Math.min(userMsgs.length, assistantMsgs.length);

  const snippets = userMsgs
    .slice(-maxSnippets)
    .map((m) => compactLine(m.content, 90))
    .filter(Boolean);

  const corpus = messages
    .slice(-12)
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const beats: string[] = [];
  if (/edge|edging|deny|denial|not yet|hold it|don't cum|dont cum/.test(corpus)) {
    beats.push("edging / denial pacing");
  }
  if (/sheer|thong|pouch|mesh|wet spot|precum/.test(corpus)) {
    beats.push("sheer fabric / wet outline focus");
  }
  if (/crotchless|open panel|pussy|clit|lace/.test(corpus)) {
    beats.push("crotchless / open-panel focus");
  }
  if (/gym|workout|sweat|reps|set\b/.test(corpus)) {
    beats.push("gym / sweat energy");
  }
  if (/shy|blush|whisper|nervous/.test(corpus)) {
    beats.push("shy / soft energy");
  }
  if (/brat|beg|please|good boy|good girl/.test(corpus)) {
    beats.push("brat / soft-dom game energy");
  }
  if (beats.length === 0) {
    beats.push("slow tease / live cam rapport");
  }

  const lines = [
    `Session with ${characterName}: ~${turns} turn(s), ${messages.length} message(s).`,
    `Ongoing vibe: ${beats.slice(0, 3).join("; ")}.`,
  ];

  if (snippets.length) {
    lines.push(`Recent user beats: ${snippets.map((s) => `“${s}”`).join(" · ")}`);
  }

  lines.push("Stay consistent with these beats; do not reset the scene without a reason.");
  return lines.join(" ");
}

function compactLine(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trim()}…`;
}
