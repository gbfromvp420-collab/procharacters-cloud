/**
 * Studio Forge v3 — client DNA types + sentiment band helpers.
 * Mirrors backend NaughtySyntaxDna shape for export / live preview.
 */

import type { MediaClipKey } from "./types";

export interface AdaptivePromptCore {
  version: string;
  core: string;
  branches: {
    dark: string;
    chaotic: string;
    flirty: string;
  };
  booster?: string;
}

export interface BehaviorTreeNode {
  id: string;
  label: string;
  triggers: string[];
  action: string;
  edges?: {
    escalate?: string;
    soft?: string;
    deny?: string;
  };
}

export interface BehaviorTree {
  version: string;
  rootId: string;
  nodes: BehaviorTreeNode[];
}

export interface LiveKitForgeMeta {
  version: string;
  bandOrder: MediaClipKey[];
  intensityMap: Array<{ min: number; max: number; band: MediaClipKey }>;
  poseByBand: Record<MediaClipKey, string>;
  expressionByBand: Record<MediaClipKey, string>;
  sentimentClips: Array<{
    sentiment: string;
    keywords: string[];
    band: MediaClipKey;
  }>;
}

export interface ClipTagMap {
  idle: string[];
  teasing: string[];
  playful: string[];
  aroused: string[];
  transitions: Array<{
    from: MediaClipKey;
    to: MediaClipKey;
    when: "escalate" | "cool" | "deny" | "praise";
  }>;
}

export interface MemorySeed {
  id: string;
  kind: "kink" | "ritual" | "name" | "boundary" | "obsession" | "scene";
  text: string;
  weight: number;
}

export interface ForgeEvolutionVector {
  power: number;
  intimacy: number;
  chaos: number;
  denial: number;
  pace: number;
}

export interface NaughtySyntaxDna {
  version: "3.0";
  forgedAt: string;
  source: "llm" | "heuristic" | "manual";
  fantasyRaw: string;
  displayName: string;
  identity: string;
  vibe: string;
  vibeTags: string[];
  baseModelId: string;
  keyPhrases: string[];
  scenes: Array<{ title: string; body: string }>;
  adaptivePrompt: AdaptivePromptCore;
  behaviorTree: BehaviorTree;
  livekit: LiveKitForgeMeta;
  clipTags: ClipTagMap;
  memorySeeds: MemorySeed[];
  evolution: ForgeEvolutionVector;
  starterLine?: string;
  expandMs?: number;
}

export interface ForgeExpandResponse {
  dna: NaughtySyntaxDna;
  form: {
    name: string;
    appearance: string;
    energy: string;
    baseModelId: string;
    keyPhrases: string[];
    scenes: Array<{ title: string; body: string }>;
    clothing?: string;
  };
  expandMs: number | null;
  source: string;
}

/** Map free text → clip band using DNA sentiment keywords (or defaults). */
export function sentimentToBand(text: string, dna?: NaughtySyntaxDna | null): MediaClipKey {
  const lower = text.toLowerCase();
  const clips = dna?.livekit?.sentimentClips ?? [
    {
      sentiment: "soft",
      keywords: ["slow", "gentle", "kiss", "hold me", "soft", "whisper"],
      band: "idle" as MediaClipKey,
    },
    {
      sentiment: "tease",
      keywords: ["tease", "look", "show", "deny", "not yet", "please"],
      band: "teasing" as MediaClipKey,
    },
    {
      sentiment: "play",
      keywords: ["play", "game", "count", "dare", "laugh", "fun"],
      band: "playful" as MediaClipKey,
    },
    {
      sentiment: "edge",
      keywords: ["edge", "hard", "close", "almost", "cum", "finish", "beg"],
      band: "aroused" as MediaClipKey,
    },
  ];

  let best: { band: MediaClipKey; score: number } = {
    band: "teasing",
    score: 0,
  };
  for (const row of clips) {
    let score = 0;
    for (const kw of row.keywords) {
      if (lower.includes(kw.toLowerCase())) score += 1;
    }
    if (score > best.score) best = { band: row.band, score };
  }
  return best.band;
}

/** Intensity 0–1 from evolution + fantasy heat words. */
export function estimateIntensity(text: string, dna?: NaughtySyntaxDna | null): number {
  const lower = text.toLowerCase();
  let n = 0.35 + (dna?.evolution.denial ?? 0.5) * 0.2;
  if (/\bedg|hard|cum|finish|beg|obsess\b/.test(lower)) n += 0.35;
  if (/\btease|deny|please\b/.test(lower)) n += 0.15;
  if (/\bslow|soft|kiss|hold\b/.test(lower)) n -= 0.1;
  return Math.min(1, Math.max(0, n));
}

export function downloadDnaJson(dna: NaughtySyntaxDna, filename?: string): void {
  const blob = new Blob([JSON.stringify(dna, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ||
    `ns-dna-${dna.displayName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "model"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const FORGE_EXAMPLE_PROMPTS = [
  "Shy Latino twink named Diego who edges me for hours, sheer thong, whispers Spanish when I beg",
  "Soft-goth girl Luna, candlelight, crotchless lace, ritual denial until I say her name right",
  "Gym brat Mateo post-workout, sweaty, interval edging games, mean-soft praise",
  "Alt punk Rio in black mesh, chaotic dares, laughs when I get close then denies",
];
