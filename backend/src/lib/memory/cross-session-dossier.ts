/**
 * Cross-session dossier — brain memory of *you* across chats (opt-in only).
 *
 * Heuristic, no extra LLM call. Merges durable signals from this session
 * into a compact dossier the character reloads next time.
 */

import type { MemoryMessage } from "./types.js";

const MAX_DOSSIER = 1400;
const MAX_LINES = 18;

export interface DossierBuildInput {
  /** Existing dossier from prior sessions (if any). */
  priorDossier?: string;
  /** Live session notes blurb. */
  sessionNotes: string;
  messages: MemoryMessage[];
  characterName?: string;
}

/**
 * Build / refresh the long-term note block stored per account+character.
 */
export function buildCrossSessionDossier(input: DossierBuildInput): string {
  const characterName = input.characterName?.trim() || "the character";
  const prior = parseSections(input.priorDossier ?? "");
  const extracted = extractSignals(input.messages);

  // Who they are
  const who = unique([
    ...prior.who,
    ...extracted.names.map((n) => `Called: ${n}`),
    ...extracted.who,
  ]).slice(0, 4);

  // What they want / like
  const wants = unique([...prior.wants, ...extracted.wants]).slice(0, 6);

  // Recurring heat / scene beats
  const heat = unique([...prior.heat, ...extracted.heat, ...beatsFromNotes(input.sessionNotes)]).slice(
    0,
    6,
  );

  // Rolling session log (newest first)
  const sessionLine = compactSessionLine(input.sessionNotes, characterName);
  const sessions = unique([sessionLine, ...prior.sessions].filter(Boolean)).slice(0, 5);

  const lines: string[] = [
    `Long-term memory with ${characterName} (opt-in). Use lightly — this chat is live.`,
  ];

  if (who.length) {
    lines.push("Who they are:");
    for (const w of who) lines.push(`- ${w}`);
  }
  if (wants.length) {
    lines.push("What they want:");
    for (const w of wants) lines.push(`- ${w}`);
  }
  if (heat.length) {
    lines.push("Recurring heat:");
    for (const h of heat) lines.push(`- ${h}`);
  }
  if (sessions.length) {
    lines.push("Recent sessions:");
    for (const s of sessions) lines.push(`- ${s}`);
  }

  if (lines.length === 1) {
    lines.push("- Still learning them — open slow and notice what they respond to.");
  }

  return clampDossier(lines.join("\n"));
}

/** One-line cue for opening when they return. */
export function returnGreetingHint(priorDossier?: string): string | null {
  if (!priorDossier?.trim()) return null;
  const names = [...priorDossier.matchAll(/(?:Called|call(?:ed)? me|name(?:'s| is)?)\s*[:\s]+([A-Za-z][\w.-]{1,24})/gi)].map(
    (m) => m[1],
  );
  const name = names[0];
  if (name) {
    return `(i still remember you, ${name} — bits of our heat are still here. pick up with me.)`;
  }
  if (/What they want:|Recurring heat:|Recent sessions:/i.test(priorDossier)) {
    return `(i still remember bits of you — our last heat didn’t fully leave. pick up with me.)`;
  }
  return `(welcome back… i kept a little of you. slow with me.)`;
}

// ── extractors ──────────────────────────────────────────────

function extractSignals(messages: MemoryMessage[]): {
  names: string[];
  who: string[];
  wants: string[];
  heat: string[];
} {
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const allText = messages.map((m) => m.content).join("\n").toLowerCase();

  const names = new Set<string>();
  const who: string[] = [];
  const wants: string[] = [];
  const heat: string[] = [];

  const namePatterns = [
    /\b(?:my name is|i'm|i am|call me|it's)\s+([A-Z][a-zA-Z.-]{1,20})\b/g,
    /\b(?:my name is|i'm|i am|call me)\s+([a-z]{2,20})\b/gi,
  ];
  for (const re of namePatterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(userText)) !== null) {
      const n = m[1]!.replace(/[^a-zA-Z.-]/g, "");
      if (n.length >= 2 && !STOP_NAMES.has(n.toLowerCase())) {
        names.add(n.charAt(0).toUpperCase() + n.slice(1).toLowerCase());
      }
    }
  }

  // Preference lines from user
  for (const msg of messages.filter((m) => m.role === "user").slice(-12)) {
    const line = msg.content.replace(/\s+/g, " ").trim();
    if (line.length < 8 || line.length > 160) continue;
    const lower = line.toLowerCase();
    if (
      /i (like|love|want|need|prefer|hate|don't like|dont like)/.test(lower) ||
      /make me|edge me|deny me|call me|don't stop|dont stop|faster|slower|harder|softer/.test(
        lower,
      )
    ) {
      wants.push(clip(line, 100));
    }
  }

  // Heat themes from whole transcript
  if (/edge|edging|deny|denial|hold it|don't cum|dont cum/.test(allText)) {
    heat.push("edging / denial responsive");
  }
  if (/praise|good boy|good girl|proud/.test(allText)) {
    heat.push("praise-sensitive");
  }
  if (/brat|beg|please/.test(allText)) {
    heat.push("brat / beg dynamic");
  }
  if (/shy|blush|whisper|nervous/.test(allText)) {
    heat.push("likes shy / soft energy");
  }
  if (/gym|sweat|workout|reps/.test(allText)) {
    heat.push("gym / sweat scenes");
  }
  if (/mesh|thong|sheer|crotchless|open panel/.test(allText)) {
    heat.push("visual clothing / outline focus");
  }
  if (/spanish|español|papi|mío|mio/.test(allText)) {
    heat.push("soft Spanish / bilingual heat");
  }

  return {
    names: [...names].slice(0, 3),
    who: who.slice(0, 3),
    wants: unique(wants).slice(0, 5),
    heat: unique(heat).slice(0, 5),
  };
}

const STOP_NAMES = new Set([
  "here",
  "back",
  "ready",
  "horny",
  "hard",
  "wet",
  "down",
  "into",
  "just",
  "really",
  "so",
  "not",
  "the",
  "your",
  "you",
]);

function beatsFromNotes(notes: string): string[] {
  const m = notes.match(/Ongoing vibe:\s*([^.]+)/i);
  if (!m?.[1]) return [];
  return m[1]
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 80)
    .slice(0, 3);
}

function compactSessionLine(sessionNotes: string, characterName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const vibe =
    sessionNotes.match(/Ongoing vibe:\s*([^.]+)/i)?.[1]?.trim().slice(0, 90) ||
    sessionNotes.slice(0, 90).replace(/\s+/g, " ");
  return `${date} · ${characterName}: ${vibe || "session heat"}`;
}

// ── section parse / merge helpers ───────────────────────────

interface Sections {
  who: string[];
  wants: string[];
  heat: string[];
  sessions: string[];
}

function parseSections(dossier: string): Sections {
  const empty: Sections = { who: [], wants: [], heat: [], sessions: [] };
  if (!dossier.trim()) return empty;

  let section: keyof Sections | null = null;
  for (const raw of dossier.split("\n")) {
    const line = raw.trim();
    if (/^Who they are/i.test(line)) {
      section = "who";
      continue;
    }
    if (/^What they want/i.test(line)) {
      section = "wants";
      continue;
    }
    if (/^Recurring heat/i.test(line)) {
      section = "heat";
      continue;
    }
    if (/^Recent sessions/i.test(line)) {
      section = "sessions";
      continue;
    }
    if (!section || !line.startsWith("-")) continue;
    const item = line.replace(/^-\s*/, "").trim();
    if (item) empty[section].push(item);
  }

  // Legacy free-text dossier: keep as a single heat line
  if (
    !empty.who.length &&
    !empty.wants.length &&
    !empty.heat.length &&
    !empty.sessions.length &&
    dossier.trim().length > 20
  ) {
    empty.heat.push(clip(dossier.replace(/\s+/g, " "), 120));
  }

  return empty;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
  }
  return out;
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function clampDossier(text: string): string {
  let lines = text.split("\n");
  if (lines.length > MAX_LINES) {
    lines = lines.slice(0, MAX_LINES);
  }
  let joined = lines.join("\n");
  if (joined.length > MAX_DOSSIER) {
    joined = `${joined.slice(0, MAX_DOSSIER - 1).trim()}…`;
  }
  return joined;
}
