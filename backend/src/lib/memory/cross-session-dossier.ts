/**
 * Cross-session dossier — brain memory of *you* across chats (opt-in only).
 *
 * Heuristic, no extra LLM call. Merges durable signals from this session
 * into a compact dossier the character reloads next time.
 *
 * Return Intelligence: richer extractors + named, heat-specific return cues
 * so re-entry feels like recognition — not a cold open.
 */

import type { MemoryMessage } from "./types.js";

const MAX_DOSSIER = 1600;
const MAX_LINES = 22;

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
  const extracted = extractSignals(input.messages, input.sessionNotes);

  // Who they are
  const who = unique([
    ...prior.who,
    ...extracted.names.map((n) => `Called: ${n}`),
    ...extracted.who,
  ]).slice(0, 5);

  // What they want / like
  const wants = unique([...prior.wants, ...extracted.wants]).slice(0, 6);

  // Recurring heat / scene beats
  const heat = unique([
    ...prior.heat,
    ...extracted.heat,
    ...beatsFromNotes(input.sessionNotes),
  ]).slice(0, 7);

  // Last scene fingerprint (pose/act/clothing) — gold for re-entry
  const lastScene = unique([
    ...extracted.lastScene,
    ...prior.lastScene,
  ]).slice(0, 4);

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
  if (lastScene.length) {
    lines.push("Last scene lock:");
    for (const s of lastScene) lines.push(`- ${s}`);
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

/** Structured bits for UI return cards (no LLM). */
export function parseReturnSignals(priorDossier?: string | null): {
  name: string | null;
  wants: string[];
  heat: string[];
  lastScene: string[];
  sessions: string[];
} {
  const prior = parseSections(priorDossier ?? "");
  const nameRaw =
    prior.who
      .map((w) => w.match(/^Called:\s*(.+)/i)?.[1]?.trim())
      .find(Boolean) ??
    priorDossier?.match(/(?:Called|call(?:ed)? me)\s*[:\s]+([A-Za-z][\w.-]{1,24})/i)?.[1] ??
    null;
  const name = cleanName(nameRaw);
  return {
    name,
    wants: prior.wants.slice(0, 4),
    heat: prior.heat.slice(0, 4),
    lastScene: prior.lastScene.slice(0, 3),
    sessions: prior.sessions.slice(0, 2),
  };
}

/**
 * One-line cue for opening when they return — specific when we have signals.
 * Character-flavored soft spice when characterId known.
 */
export function returnGreetingHint(
  priorDossier?: string,
  characterId?: string,
): string | null {
  if (!priorDossier?.trim()) return null;

  const sig = parseReturnSignals(priorDossier);
  const name = sig.name;
  const heatBit = sig.heat[0]?.replace(/^Responds to |^likes /i, "") || null;
  const wantBit = sig.wants[0] ? clip(sig.wants[0], 48) : null;
  const sceneBit = preferSceneBit(sig.lastScene);
  const mind = mindTag(characterId);

  // DNA power climb from durable dossier (survives expired resume)
  const dnaMatch =
    priorDossier.match(/DNA power climb:\s*([^(\n]+)/i) ||
    priorDossier.match(/DNA tree ·\s*([^.]+)/i);
  const dnaLabel = dnaMatch?.[1]?.trim().replace(/\s*·\s*Edge Pace\s*$/i, "") || null;

  // Highest specificity first
  if (name && dnaLabel) {
    return softLine(
      `i still remember you, ${name} — we left DNA · ${clip(dnaLabel, 28)}. climb with me.`,
      mind,
    );
  }
  if (dnaLabel && sceneBit) {
    return softLine(
      `DNA · ${clip(dnaLabel, 24)} is still live — last pose ${sceneBit}. don’t cold-reset.`,
      mind,
    );
  }
  if (dnaLabel) {
    return softLine(
      `your DNA climb is still at ${clip(dnaLabel, 28)} — i kept the node. pick up with me.`,
      mind,
    );
  }
  if (name && sceneBit) {
    return softLine(
      `i still remember you, ${name} — last time we left it ${sceneBit}. pick up with me.`,
      mind,
    );
  }
  if (name && heatBit) {
    return softLine(
      `i still remember you, ${name} — that ${heatBit} didn’t leave. slow with me.`,
      mind,
    );
  }
  if (name && wantBit) {
    return softLine(
      `hey ${name}… i kept what you wanted — “${wantBit}”. show me again.`,
      mind,
    );
  }
  if (name) {
    return softLine(
      `i still remember you, ${name} — bits of our heat are still here. pick up with me.`,
      mind,
    );
  }
  if (sceneBit) {
    return softLine(
      `i kept our last pose — ${sceneBit}. don’t make me start over.`,
      mind,
    );
  }
  if (heatBit) {
    return softLine(
      `i still remember bits of you — ${heatBit}. our last heat didn’t fully leave.`,
      mind,
    );
  }
  if (/What they want:|Recurring heat:|Recent sessions:|Last scene lock:/i.test(priorDossier)) {
    return softLine(
      `i still remember bits of you — our last heat didn’t fully leave. pick up with me.`,
      mind,
    );
  }
  return softLine(`welcome back… i kept a little of you. slow with me.`, mind);
}

/** User-side pick-up seeds for the return card (composer). */
export function returnPickupSeeds(priorDossier?: string | null): string[] {
  const sig = parseReturnSignals(priorDossier);
  const seeds: string[] = [];
  const dnaMatch =
    priorDossier?.match(/DNA power climb:\s*([^(\n]+)/i) ||
    priorDossier?.match(/DNA tree ·\s*([^.]+)/i);
  const dnaLabel = dnaMatch?.[1]?.trim().replace(/\s*·\s*Edge Pace\s*$/i, "") || null;
  if (dnaLabel) {
    seeds.push(`DNA · ${clip(dnaLabel, 24)} — keep climbing, don’t reset`);
  }
  if (sig.name) {
    seeds.push(`you remembered… call me ${sig.name} again while you edge me`);
  }
  if (sig.lastScene[0]) {
    seeds.push(`pick up where we left — ${sig.lastScene[0]}`);
  }
  if (sig.heat[0]) {
    seeds.push(`you know what i like — ${clip(sig.heat[0], 40)}`);
  }
  if (sig.wants[0]) {
    seeds.push(`same as last time — ${clip(sig.wants[0], 50)}`);
  }
  if (!seeds.length) {
    seeds.push("you kept a little of me… don’t cold-open");
    seeds.push("pick up our heat — slow");
  }
  return unique(seeds).slice(0, 4);
}

function softLine(line: string, mind: string | null): string {
  const body = mind ? `${line} — ${mind}` : line;
  return `(${body})`;
}

/** Prefer pose/act over clothing for spoken return lines. */
function preferSceneBit(lastScene: string[]): string | null {
  if (!lastScene.length) return null;
  const pose = lastScene.find((s) => /^pose:/i.test(s));
  const act = lastScene.find((s) => /^act:/i.test(s));
  const left = lastScene.find((s) => /^left at:/i.test(s));
  const clothing = lastScene.find((s) => /^clothing:/i.test(s));
  const raw = pose || act || left || clothing || lastScene[0]!;
  return raw.replace(/^(clothing|pose|act|left at):\s*/i, "").trim();
}

function cleanName(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const n = raw.replace(/[.\s,!?]+$/g, "").trim();
  if (n.length < 2 || STOP_NAMES.has(n.toLowerCase())) return null;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function mindTag(characterId?: string): string | null {
  if (!characterId) return null;
  if (characterId.includes("gym")) return "still post-set for you";
  if (characterId.includes("shy")) return "soft voice, same blush";
  if (characterId.includes("punk") || characterId.includes("alt")) return "same mean-soft grin";
  if (characterId.includes("goth")) return "ritual still open";
  if (characterId.includes("athletic")) return "cool-down isn’t over";
  if (characterId.includes("brat") || characterId.includes("playful")) return "still playing";
  if (characterId.includes("female")) return "panel still open";
  if (characterId.includes("twink")) return "sheer still on";
  return null;
}

// ── extractors ──────────────────────────────────────────────

function extractSignals(
  messages: MemoryMessage[],
  sessionNotes?: string,
): {
  names: string[];
  who: string[];
  wants: string[];
  heat: string[];
  lastScene: string[];
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
  const lastScene: string[] = [];

  const namePatterns = [
    /\b(?:my name is|i'm|i am|call me|it's)\s+([A-Z][a-zA-Z.-]{1,20})\b/g,
    /\b(?:my name is|i'm|i am|call me)\s+([a-z]{2,20})\b/gi,
  ];
  for (const re of namePatterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(userText)) !== null) {
      const cleaned = cleanName(m[1]!.replace(/[^a-zA-Z.-]/g, ""));
      if (cleaned) names.add(cleaned);
    }
  }

  // Scene lock may carry called=
  const calledFromNotes = cleanName(
    sessionNotes?.match(/called=([A-Za-z][\w.-]{1,18})/i)?.[1],
  );
  if (calledFromNotes) names.add(calledFromNotes);

  // Preference lines from user
  for (const msg of messages.filter((m) => m.role === "user").slice(-14)) {
    const line = msg.content.replace(/\s+/g, " ").trim();
    if (line.length < 8 || line.length > 160) continue;
    const lower = line.toLowerCase();
    if (
      /i (like|love|want|need|prefer|hate|don't like|dont like)/.test(lower) ||
      /make me|edge me|deny me|call me|don't stop|dont stop|faster|slower|harder|softer|keep (the|that)|stay /.test(
        lower,
      )
    ) {
      wants.push(clip(line, 100));
    }
  }

  // Heat themes from whole transcript
  if (/edge|edging|deny|denial|hold it|don't cum|dont cum|not yet/.test(allText)) {
    heat.push("edging / denial responsive");
  }
  if (/praise|good boy|good girl|proud|so good/.test(allText)) {
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
  if (/mesh|thong|sheer|crotchless|open panel|lace/.test(allText)) {
    heat.push("visual clothing / outline focus");
  }
  if (/spanish|español|papi|mío|mio|mírame|mirame|aguanta/.test(allText)) {
    heat.push("soft Spanish / bilingual heat");
  }
  if (/kiss|french|tongue|mouth/.test(allText)) {
    heat.push("kissing / mouth heat");
  }
  if (/handjob|stroke|palm|grip|fingers/.test(allText)) {
    heat.push("hands-on pacing");
  }
  if (/count|interval|reps|set\b/.test(allText)) {
    heat.push("count / interval games");
  }

  // Last scene from notes Scene lock
  if (sessionNotes) {
    const scene = sessionNotes.match(/Scene lock:\s*([^.]+)/i)?.[1] ?? "";
    const clothing = scene.match(/clothing="([^"]+)"/i)?.[1];
    const pose = scene.match(/pose=([^;]+)/i)?.[1]?.trim();
    const act = scene.match(/act=([^;]+)/i)?.[1]?.trim();
    const arousal = scene.match(/arousal=([^;]+)/i)?.[1]?.trim();
    if (clothing) lastScene.push(`clothing: ${clothing}`);
    if (pose && !/live cam presence/i.test(pose)) lastScene.push(`pose: ${pose}`);
    if (act && !/^tease \/ escalate$/i.test(act)) lastScene.push(`act: ${act}`);
    if (arousal && /edge|peak|high|denial/i.test(arousal)) {
      lastScene.push(`left at: ${arousal}`);
    }
  }

  return {
    names: [...names].slice(0, 3),
    who: who.slice(0, 3),
    wants: unique(wants).slice(0, 5),
    heat: unique(heat).slice(0, 6),
    lastScene: unique(lastScene).slice(0, 4),
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
  "still",
  "going",
  "about",
]);

function beatsFromNotes(notes: string): string[] {
  const m = notes.match(/Ongoing vibe:\s*([^.]+)/i);
  if (!m?.[1]) return [];
  return m[1]
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 80 && !/^heat ·/i.test(s))
    .slice(0, 3);
}

function compactSessionLine(sessionNotes: string, characterName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const vibe =
    sessionNotes.match(/Ongoing vibe:\s*([^.]+)/i)?.[1]?.trim().slice(0, 90) ||
    sessionNotes.slice(0, 90).replace(/\s+/g, " ");
  const scene =
    sessionNotes.match(/pose=([^;]+)/i)?.[1]?.trim() ||
    sessionNotes.match(/act=([^;]+)/i)?.[1]?.trim() ||
    "";
  const tail = scene ? ` · ${scene}` : "";
  return `${date} · ${characterName}: ${vibe || "session heat"}${tail}`;
}

// ── section parse / merge helpers ───────────────────────────

interface Sections {
  who: string[];
  wants: string[];
  heat: string[];
  lastScene: string[];
  sessions: string[];
}

function parseSections(dossier: string): Sections {
  const empty: Sections = {
    who: [],
    wants: [],
    heat: [],
    lastScene: [],
    sessions: [],
  };
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
    if (/^Last scene lock/i.test(line)) {
      section = "lastScene";
      continue;
    }
    if (/^Recent sessions/i.test(line)) {
      section = "sessions";
      continue;
    }
    if (/^Learned heat prefs/i.test(line)) {
      empty.heat.push(line.replace(/^Learned heat prefs\s*/i, "").trim() || line);
      section = null;
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
    !empty.lastScene.length &&
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
