/**
 * Heat trail stamp for multi-device reclaim.
 * Mirrors frontend/src/lib/resume-cache.ts so gallery / Continue / push
 * see the same recap + chips on a second phone — not just a resume code.
 */

export type HeatTrailDepth = "spark" | "warm" | "edge" | "deep" | "locked";

export type HeatTrailStamp = {
  recapLine?: string;
  heatDepth?: HeatTrailDepth;
  heatChips?: string[];
  dnaTreeLabel?: string;
};

/** Pretty DNA node label (push copy + session list). */
export function dnaLabelFromNodeId(nodeId?: string | null): string | undefined {
  if (!nodeId?.trim()) return undefined;
  const id = nodeId.trim().toLowerCase();
  if (id.includes("release")) return "Release";
  if (id.includes("deny")) return "Deny";
  if (id.includes("edge")) return "Edge";
  if (id.includes("tease")) return "Tease";
  if (id.includes("soft")) return "Soft lock";
  if (id.includes("spark")) return "Spark";
  return nodeId.trim();
}

export function heatDepthFromCount(messageCount: number): HeatTrailDepth {
  if (messageCount >= 20) return "locked";
  if (messageCount >= 12) return "deep";
  if (messageCount >= 6) return "edge";
  if (messageCount >= 2) return "warm";
  return "spark";
}

/** Short “who you left on edge” line from session notes. */
export function recapFromSessionNotes(notes?: string | null): string | null {
  if (!notes?.trim()) return null;
  const text = notes.replace(/\s+/g, " ").trim();
  const lastBeat = text.match(/Last character beat:\s*[“"](.+?)[”"]/i)?.[1]?.trim();
  if (lastBeat) {
    return lastBeat.length > 110 ? `${lastBeat.slice(0, 107).trim()}…` : lastBeat;
  }
  const scene = text.match(/Scene lock:\s*([^.]{8,140})/i)?.[1] ?? "";
  const pose = scene.match(/pose=([^;]+)/i)?.[1]?.trim();
  const act = scene.match(/act=([^;]+)/i)?.[1]?.trim();
  const clothing = scene.match(/clothing="([^"]+)"/i)?.[1]?.trim();
  const spoken = [pose, act, clothing]
    .filter((x) => x && !/live cam presence|^tease \/ escalate$/i.test(x))
    .slice(0, 2);
  if (spoken.length) {
    const line = spoken.join(" · ");
    return line.length > 90 ? `${line.slice(0, 87).trim()}…` : line;
  }
  const vibe = text.match(/Ongoing vibe:\s*([^.]+)/i)?.[1]?.trim();
  if (vibe) {
    const clean = vibe.replace(/heat · \w+;?\s*/i, "").trim();
    if (clean) return clean.length > 90 ? `${clean.slice(0, 87).trim()}…` : clean;
  }
  if (scene) return scene.length > 90 ? `${scene.slice(0, 87).trim()}…` : scene;
  return null;
}

/** Derive gallery/Continue trail from persisted session notes + DNA node. */
export function heatTrailFromSessionNotes(options: {
  sessionNotes?: string | null;
  messageCount?: number;
  dnaTreeNodeId?: string | null;
  dnaTreeLabel?: string | null;
}): HeatTrailStamp {
  const notes = options.sessionNotes ?? "";
  const messageCount = options.messageCount ?? 0;
  const chips: string[] = [];
  const text = notes.replace(/\s+/g, " ").trim();

  const scene = text.match(/Scene lock:\s*([^.]{0,160})/i)?.[1] ?? "";
  const clothing = scene.match(/clothing="([^"]+)"/i)?.[1]?.trim();
  const pose = scene.match(/pose=([^;]+)/i)?.[1]?.trim();
  const act = scene.match(/act=([^;]+)/i)?.[1]?.trim();
  const arousal = scene.match(/arousal=([^;]+)/i)?.[1]?.trim();
  if (pose && !/live cam presence/i.test(pose)) chips.push(pose);
  if (act && !/^tease \/ escalate$/i.test(act)) chips.push(act);
  if (clothing) chips.push(clothing);
  if (arousal && /edge|peak|high|denial|aroused/i.test(arousal)) {
    chips.push(arousal.length > 22 ? `${arousal.slice(0, 20)}…` : arousal);
  }

  const vibe = text.match(/Ongoing vibe:\s*([^.]+)/i)?.[1] ?? "";
  for (const part of vibe.split(";")) {
    const p = part.trim();
    if (
      p &&
      chips.length < 5 &&
      /edge|denial|sheer|crotchless|gym|shy|brat|goth|kiss|hand|pace|dna tree/i.test(p) &&
      !/^heat ·/i.test(p)
    ) {
      chips.push(p.length > 24 ? `${p.slice(0, 22)}…` : p);
    }
  }

  const dnaFromNotes = text.match(/DNA tree ·\s*([^↑.]+)/i)?.[1]?.trim();
  const dnaTreeLabel =
    options.dnaTreeLabel?.trim() ||
    dnaFromNotes ||
    dnaLabelFromNodeId(options.dnaTreeNodeId) ||
    undefined;
  if (dnaTreeLabel && chips.length < 5) {
    chips.unshift(
      dnaTreeLabel.length > 22 ? `DNA ${dnaTreeLabel.slice(0, 18)}…` : `DNA ${dnaTreeLabel}`,
    );
  }

  const fromNotes = text.match(/heat · (spark|warm|edge|deep|locked)/i)?.[1]?.toLowerCase() as
    | HeatTrailDepth
    | undefined;
  const heatDepth = fromNotes || (messageCount > 0 ? heatDepthFromCount(messageCount) : undefined);
  const recap = recapFromSessionNotes(notes) ?? undefined;

  return {
    ...(recap ? { recapLine: recap } : {}),
    ...(heatDepth ? { heatDepth } : {}),
    ...(chips.length ? { heatChips: uniqueChips(chips).slice(0, 4) } : {}),
    ...(dnaTreeLabel ? { dnaTreeLabel } : {}),
  };
}

function uniqueChips(items: string[]): string[] {
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
