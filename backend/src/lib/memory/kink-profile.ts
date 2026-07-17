/**
 * Lightweight kink / heat preference extraction for CharacterSession.
 * Heuristic only — no extra LLM call.
 */
import type { MemoryMessage } from "./types.js";

export type KinkProfile = {
  tags: string[];
  intensity: "soft" | "medium" | "high" | "edge";
  notes: string[];
  updatedAt: string;
};

const TAG_PATTERNS: Array<{ tag: string; re: RegExp }> = [
  { tag: "edging", re: /\bedg(e|ing|ed)\b|hold it|so close|almost there/i },
  { tag: "denial", re: /\bden(y|ial)\b|no finish|don't cum|dont cum|not yet/i },
  { tag: "praise", re: /\bgood (boy|girl|slut)\b|proud of you|that's it/i },
  { tag: "degradation", re: /\bslut|whore|filthy|dirty boy|dirty girl\b/i },
  { tag: "sheer", re: /\bsheer|thong|g-string|mesh|see-?through\b/i },
  { tag: "crotchless", re: /\bcrotchless|open panel|open-panel\b/i },
  { tag: "dom", re: /\bdom(me|inant)?\b|on your knees|obey|beg\b/i },
  { tag: "sub", re: /\bsub(missive)?\b|i'?ll obey|please let me\b/i },
  { tag: "mirror", re: /\bmirror\b|watch yourself|look at yourself\b/i },
  { tag: "webcam", re: /\bwebcam|on cam|camera\b/i },
  { tag: "slow", re: /\bslow|tease|teasing|take your time\b/i },
  { tag: "fast", re: /\bfaster|harder|don't stop|dont stop\b/i },
];

/** Merge prior profile with signals from recent messages. */
export function evolveKinkProfile(
  messages: MemoryMessage[],
  prior?: Partial<KinkProfile> | null,
): KinkProfile {
  const corpus = messages
    .slice(-24)
    .map((m) => m.content)
    .join("\n");

  const found = new Set<string>(Array.isArray(prior?.tags) ? prior!.tags! : []);
  for (const { tag, re } of TAG_PATTERNS) {
    if (re.test(corpus)) found.add(tag);
  }

  const intensity = scoreIntensity(corpus, found);
  const notes = unique([
    ...(Array.isArray(prior?.notes) ? prior!.notes! : []),
    ...noteHints(found, intensity),
  ]).slice(0, 8);

  return {
    tags: [...found].slice(0, 12),
    intensity,
    notes,
    updatedAt: new Date().toISOString(),
  };
}

/** One short prompt line for memory injection. */
export function formatKinkProfileLine(profile: KinkProfile | null | undefined): string | null {
  if (!profile?.tags?.length) return null;
  const tags = profile.tags.slice(0, 6).join(", ");
  const intensity = profile.intensity || "medium";
  return `Learned heat prefs (intensity=${intensity}): ${tags}. Escalate toward these when natural — never invent consent.`;
}

function scoreIntensity(corpus: string, tags: Set<string>): KinkProfile["intensity"] {
  if (tags.has("edging") || tags.has("denial") || /so close|almost cum|ruin/i.test(corpus)) {
    return "edge";
  }
  if (tags.has("dom") || tags.has("degradation") || /harder|destroy|wreck/i.test(corpus)) {
    return "high";
  }
  if (tags.has("slow") || tags.has("praise") || /gentle|soft|tease/i.test(corpus)) {
    return "soft";
  }
  return tags.size >= 3 ? "medium" : "soft";
}

function noteHints(tags: Set<string>, intensity: KinkProfile["intensity"]): string[] {
  const out: string[] = [];
  if (tags.has("edging") || tags.has("denial")) {
    out.push("Responds to edging / denial pacing");
  }
  if (tags.has("sheer") || tags.has("crotchless")) {
    out.push("Clothing/sheer detail lands hard");
  }
  if (intensity === "edge") {
    out.push("Keep them on the edge — no free finish");
  }
  return out;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}
