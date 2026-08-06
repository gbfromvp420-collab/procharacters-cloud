import { getLiveCharacterProfile } from "../live/character-catalog.js";
import { getPresenceProfile } from "../live/presence-profiles.js";
import type { EdgePhase, SessionMode } from "../live/session-mode.js";
import { extractSceneLock } from "./session-memory.js";
import type { MemoryMessage } from "./types.js";

/**
 * Build a short "what we remember" blurb for prompt injection + UI.
 * Heuristic only (no extra LLM call) — fast and cheap for live turns.
 * Presence-aware: seeds the character’s signature vibe into the blurb.
 * Always stamps a Scene lock so resume + mid-session stay sticky.
 */
export function buildSessionNotes(
  messages: MemoryMessage[],
  options?: {
    characterName?: string;
    characterId?: string;
    sessionMode?: SessionMode;
    edgePhase?: EdgePhase;
    maxUserSnippets?: number;
  },
): string {
  const characterName = options?.characterName?.trim() || "the character";
  const characterId = options?.characterId;
  const maxSnippets = options?.maxUserSnippets ?? 3;

  const presenceSeed = characterId
    ? getPresenceProfile(characterId).defaults.emotion
    : undefined;
  const energyLabel = characterId
    ? getLiveCharacterProfile(characterId)?.energyLabel
    : undefined;

  if (messages.length === 0) {
    const seed =
      energyLabel || presenceSeed
        ? ` Signature vibe: ${energyLabel ?? presenceSeed}.`
        : "";
    return `Just starting with ${characterName}.${seed} No prior beats yet — open slow and stay in character.`;
  }

  const userMsgs = messages.filter((m) => m.role === "user");
  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  const turns = Math.min(userMsgs.length, assistantMsgs.length);

  const snippets = userMsgs
    .slice(-maxSnippets)
    .map((m) => compactLine(m.content, 90))
    .filter(Boolean);

  const lastAssistant = assistantMsgs.at(-1);
  const assistantBeat = lastAssistant
    ? compactLine(lastAssistant.content, 100)
    : "";

  const corpus = messages
    .slice(-12)
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const beats: string[] = [];

  // Character presence first — brain identity
  if (energyLabel) {
    beats.push(energyLabel.split(",")[0]?.trim() || energyLabel);
  } else if (presenceSeed) {
    beats.push(`${presenceSeed} presence`);
  }

  if (options?.sessionMode === "edge_pace" && options.edgePhase) {
    beats.push(`edge pace · ${options.edgePhase}`);
  }

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
  if (/goth|lace|candle|ritual/.test(corpus)) {
    beats.push("soft-goth ritual heat");
  }
  if (/kiss|french|tongue|mouth/.test(corpus)) {
    beats.push("kissing / mouth heat");
  }
  if (/handjob|stroke|palm|fingers|grip/.test(corpus)) {
    beats.push("hands-on pacing");
  }
  if (/kneel|on (?:my |your )?back|straddl|lean(?:ing)? in|mirror/.test(corpus)) {
    beats.push("pose locked in");
  }
  if (beats.length === 0) {
    beats.push("slow tease / live cam rapport");
  }

  // Heat arc label for UI + prompt (matches prompt-formatter turn bands)
  const heatArc =
    turns >= 20
      ? "locked"
      : turns >= 12
        ? "deep"
        : turns >= 6
          ? "edge"
          : turns >= 2
            ? "warm"
            : "spark";
  beats.unshift(`heat · ${heatArc}`);

  // Dedupe while preserving order
  const uniqueBeats = [...new Set(beats)].slice(0, 6);
  const sceneLock = extractSceneLock(messages, characterId);

  const lines = [
    `Session with ${characterName}: ~${turns} turn(s), ${messages.length} message(s).`,
    `Ongoing vibe: ${uniqueBeats.join("; ")}.`,
    `Scene lock: ${sceneLock}.`,
  ];

  if (snippets.length) {
    lines.push(`Recent user beats: ${snippets.map((s) => `“${s}”`).join(" · ")}`);
  }

  if (assistantBeat) {
    lines.push(`Last character beat: “${assistantBeat}”`);
  }

  lines.push(
    "Stay consistent with these beats and this character’s presence; do not reset the scene without a reason.",
  );
  return lines.join(" ");
}

/**
 * Compact seed for a *new* session that inherits prior dossier.
 * Prefer name + wants + heat + last scene over dumping raw dossier text.
 */
export function buildPriorContinuitySeed(
  priorNotes: string,
  characterName: string,
): string {
  const name = characterName.trim() || "the character";
  const prior = priorNotes.trim();
  if (!prior) {
    return `Continuing with ${name}. Prior heat may exist — open warm, don’t cold-restart.`;
  }

  const called =
    prior.match(/(?:Called|call(?:ed)? me|name(?:'s| is)?)\s*[:\s]+([A-Za-z][\w.-]{1,24})/i)?.[1] ??
    null;

  const wants = bulletSection(prior, "What they want").slice(0, 2);
  const heat = bulletSection(prior, "Recurring heat").slice(0, 2);
  const lastScene = bulletSection(prior, "Last scene lock").slice(0, 3);
  const lastSession = bulletSection(prior, "Recent sessions")[0];

  const bits: string[] = [];
  if (called) bits.push(`they go by ${called}`);
  if (wants.length) bits.push(`wants: ${wants.join("; ")}`);
  if (heat.length) bits.push(`heat: ${heat.join("; ")}`);
  if (lastScene.length) bits.push(`last scene: ${lastScene.join("; ")}`);
  if (lastSession) bits.push(`last: ${compactLine(lastSession, 80)}`);

  if (!bits.length) {
    return `Continuing with ${name}. Prior vibe: ${compactLine(prior, 220)}`;
  }

  return `Continuing with ${name} (${bits.join(" · ")}). Soft recognition — pick up heat and last scene, don’t monologue the dossier.`;
}

function bulletSection(dossier: string, heading: string): string[] {
  const lines = dossier.split("\n");
  const out: string[] = [];
  let inSection = false;
  const headRe = new RegExp(`^${heading}`, "i");
  for (const raw of lines) {
    const line = raw.trim();
    if (
      /^Who they are|^What they want|^Recurring heat|^Last scene lock|^Recent sessions/i.test(
        line,
      )
    ) {
      inSection = headRe.test(line);
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith("-")) {
      const item = line.replace(/^-\s*/, "").trim();
      if (item) out.push(item);
    }
  }
  return out;
}

function compactLine(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trim()}…`;
}
