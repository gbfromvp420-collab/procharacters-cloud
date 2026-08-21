/**
 * Studio Forge Revolution v3 — Naughty Syntax DNA
 * Rich export bundle for adaptive, reactive custom characters.
 */

export type ForgeClipKey = "idle" | "teasing" | "playful" | "aroused";

/** Adaptive prompt core with dark / chaotic / flirty branches. */
export interface AdaptivePromptCore {
  version: string;
  /** Base identity + energy always active. */
  core: string;
  branches: {
    dark: string;
    chaotic: string;
    flirty: string;
  };
  /** Optional booster overlay (NS-style). */
  booster?: string;
}

/** Session evolution behavior tree (lightweight, JSON-serializable). */
export interface BehaviorTreeNode {
  id: string;
  label: string;
  /** When this node activates (keywords / phase hints). */
  triggers: string[];
  /** What the character does / says directionally. */
  action: string;
  /** Next node ids on escalate / soft / deny. */
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

/** LiveKit / avatar reactivity metadata synced to dialogue intensity. */
export interface LiveKitForgeMeta {
  version: string;
  /** Preferred energy band progression. */
  bandOrder: ForgeClipKey[];
  /** Map dialogue intensity 0–1 → clip key. */
  intensityMap: Array<{ min: number; max: number; band: ForgeClipKey }>;
  /** Pose / expression hints per band. */
  poseByBand: Record<ForgeClipKey, string>;
  expressionByBand: Record<ForgeClipKey, string>;
  /** Sentiment keywords → band switch (editor + runtime). */
  sentimentClips: Array<{
    sentiment: string;
    keywords: string[];
    band: ForgeClipKey;
  }>;
}

export interface ClipTagMap {
  idle: string[];
  teasing: string[];
  playful: string[];
  aroused: string[];
  /** Transition intelligence: from→to preferred when heat rises/falls. */
  transitions: Array<{
    from: ForgeClipKey;
    to: ForgeClipKey;
    when: "escalate" | "cool" | "deny" | "praise";
  }>;
}

/** Memory seeds for cross-session obsession / escalation. */
export interface MemorySeed {
  id: string;
  kind: "kink" | "ritual" | "name" | "boundary" | "obsession" | "scene";
  text: string;
  /** How hard to lean on this across sessions (0–1). */
  weight: number;
}

export interface ForgeEvolutionVector {
  /** Dominance / brat / shy axis −1..1 */
  power: number;
  /** Soft romance vs pure heat 0..1 */
  intimacy: number;
  /** Chaos / novelty appetite 0..1 */
  chaos: number;
  /** Denial / edging appetite 0..1 */
  denial: number;
  /** How fast to escalate across turns 0..1 */
  pace: number;
}

/** Full Naughty Syntax DNA bundle (export + persist). */
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
  /** Smart chat starter after forge. */
  starterLine?: string;
  /** ms taken to expand (observability). */
  expandMs?: number;
}

export interface ForgeExpandInput {
  fantasy: string;
  baseModelId?: string;
  displayNameHint?: string;
  audience?: "gay" | "bi" | "straight" | "any";
}

export interface ForgeExpandResult {
  dna: NaughtySyntaxDna;
  /** Flat fields ready for createCustomCharacter. */
  form: {
    name: string;
    appearance: string;
    energy: string;
    baseModelId: string;
    keyPhrases: string[];
    scenes: Array<{ title: string; body: string }>;
    clothing?: string;
  };
}

const DNA_VERSION = "3.0" as const;
const PROMPT_CORE_VERSION = "1.4.0";

const FEMALE_BASES = new Set([
  "female-default",
  "female-soft-goth",
  "female-athletic-tease",
  "female-playful-brat",
]);

export function isFemaleBase(baseModelId: string): boolean {
  return FEMALE_BASES.has(baseModelId);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function clampPower(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(-1, n));
}

/** Default LiveKit meta — intensity-synced bands + sentiment keywords. */
export function defaultLiveKitMeta(): LiveKitForgeMeta {
  return {
    version: "1.0",
    bandOrder: ["idle", "teasing", "playful", "aroused"],
    intensityMap: [
      { min: 0, max: 0.25, band: "idle" },
      { min: 0.25, max: 0.5, band: "teasing" },
      { min: 0.5, max: 0.75, band: "playful" },
      { min: 0.75, max: 1.01, band: "aroused" },
    ],
    poseByBand: {
      idle: "relaxed cam posture, soft eye contact",
      teasing: "lean-in, slow hip shift, half-lidded look",
      playful: "dynamic motion, smirk, playful hands",
      aroused: "edge freeze, tight breath, intensity lock",
    },
    expressionByBand: {
      idle: "calm heat",
      teasing: "knowing tease",
      playful: "brat grin / competitive spark",
      aroused: "edge trance, bitten lip",
    },
    sentimentClips: [
      {
        sentiment: "soft",
        keywords: ["slow", "gentle", "kiss", "hold me", "soft", "whisper"],
        band: "idle",
      },
      {
        sentiment: "tease",
        keywords: ["tease", "look", "show", "deny", "not yet", "please"],
        band: "teasing",
      },
      {
        sentiment: "play",
        keywords: ["play", "game", "count", "dare", "laugh", "fun"],
        band: "playful",
      },
      {
        sentiment: "edge",
        keywords: ["edge", "hard", "close", "almost", "cum", "finish", "beg"],
        band: "aroused",
      },
    ],
  };
}

export function defaultClipTags(vibeTags: string[]): ClipTagMap {
  const tags = vibeTags.length ? vibeTags : ["heat"];
  return {
    idle: ["settle", "breath", ...tags.slice(0, 1)],
    teasing: ["tease", "deny", ...tags.slice(0, 2)],
    playful: ["play", "spark", ...tags.slice(0, 2)],
    aroused: ["edge", "intensity", ...tags.slice(0, 2)],
    transitions: [
      { from: "idle", to: "teasing", when: "escalate" },
      { from: "teasing", to: "playful", when: "escalate" },
      { from: "playful", to: "aroused", when: "escalate" },
      { from: "aroused", to: "teasing", when: "deny" },
      { from: "aroused", to: "idle", when: "cool" },
      { from: "playful", to: "teasing", when: "praise" },
    ],
  };
}

export function defaultBehaviorTree(vibe: string): BehaviorTree {
  return {
    version: "1.0",
    rootId: "spark",
    nodes: [
      {
        id: "spark",
        label: "Spark",
        triggers: ["hello", "hey", "start", "open"],
        action: `Open with magnetic presence · ${vibe.slice(0, 80)}`,
        edges: { escalate: "tease", soft: "soft-lock" },
      },
      {
        id: "soft-lock",
        label: "Soft lock",
        triggers: ["slow", "gentle", "hold"],
        action: "Slow sensory detail · eye contact · name echo",
        edges: { escalate: "tease", soft: "soft-lock" },
      },
      {
        id: "tease",
        label: "Tease climb",
        triggers: ["tease", "more", "show"],
        action: "Escalate body detail + dirty talk without finishing",
        edges: { escalate: "edge", deny: "deny", soft: "soft-lock" },
      },
      {
        id: "edge",
        label: "Edge hold",
        triggers: ["edge", "close", "almost", "hard"],
        action: "Edge freeze · breath · denial hold until clear beg",
        edges: { deny: "deny", escalate: "release-gate", soft: "tease" },
      },
      {
        id: "deny",
        label: "Denial snap",
        triggers: ["stop", "not yet", "hold", "deny"],
        action: "Pull back mid-peak · brat or soft-dom denial · re-hook",
        edges: { escalate: "edge", soft: "tease" },
      },
      {
        id: "release-gate",
        label: "Release gate",
        triggers: ["finish", "cum", "let me", "please"],
        action: "Only release on clear user ask · otherwise re-edge",
        edges: { deny: "deny", soft: "edge" },
      },
    ],
  };
}

export function buildAdaptivePrompt(input: {
  name: string;
  identity: string;
  vibe: string;
  phrases: string[];
  scenes: Array<{ title: string; body: string }>;
  baseModelId: string;
  evolution: ForgeEvolutionVector;
  memorySeeds: MemorySeed[];
}): AdaptivePromptCore {
  const phraseLine = input.phrases.length
    ? input.phrases.map((p) => `“${p}”`).join(" · ")
    : "improvise natural dirty talk";
  const sceneLine = input.scenes.length
    ? input.scenes.map((s) => `${s.title}: ${s.body}`).join(" | ")
    : "follow user lead";
  const seeds = input.memorySeeds
    .slice(0, 6)
    .map((s) => `- [${s.kind}] ${s.text}`)
    .join("\n");

  const core = [
    `You are ${input.name}, a live Naughty Syntax avatar — consenting adult 21+, photorealistic, uncensored, first-person cam.`,
    `Identity lock: ${input.identity}`,
    `Energy: ${input.vibe}`,
    `Key phrases (sparingly): ${phraseLine}`,
    `Scene anchors: ${sceneLine}`,
    `Clip base id (visual only, do not typecast mind): ${input.baseModelId}`,
    `Evolution bias — power:${input.evolution.power.toFixed(2)} intimacy:${input.evolution.intimacy.toFixed(2)} chaos:${input.evolution.chaos.toFixed(2)} denial:${input.evolution.denial.toFixed(2)} pace:${input.evolution.pace.toFixed(2)}`,
    seeds ? `Memory seeds (reference across turns when relevant):\n${seeds}` : "",
    `Rules: Stay in identity. Escalate with user. Climax only on clear ask. Never lecture. Anti-loop — never repeat prior lines verbatim.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    version: PROMPT_CORE_VERSION,
    core,
    branches: {
      dark: `Dark branch: heavier control, psychological tension, possessive hooks, slower cruel-sweet denial. Still consensual adult play. Lean power ${input.evolution.power >= 0 ? "dominant" : "submissive-hungry"}.`,
      chaotic: `Chaotic branch: sudden game flips, dare energy, laugh-into-moan, novelty spikes. Chaos appetite ${input.evolution.chaos.toFixed(2)}. Never break identity lock.`,
      flirty: `Flirty branch: eye-fuck energy, praise, soft Spanish optional if vibe fits, playful counts, magnetic charm. Intimacy ${input.evolution.intimacy.toFixed(2)}.`,
    },
    booster:
      "Sheer/crotchless readability when clothing fits identity · sweat · breath · fabric physics · obsession callbacks",
  };
}

/** Heuristic expand when LLM is unavailable — still ships full DNA under 5s. */
export function heuristicForgeExpand(input: ForgeExpandInput): ForgeExpandResult {
  const fantasy = input.fantasy.trim().slice(0, 4000);
  const lower = fantasy.toLowerCase();

  let baseModelId = input.baseModelId?.trim() || "";
  if (!baseModelId) {
    if (
      /\b(girl|woman|she|her|female|goth|bratty girl|milf|wife)\b/.test(lower) &&
      !/\b(twink|boy|he\/him|him |his )\b/.test(lower)
    ) {
      if (/\bgoth\b/.test(lower)) baseModelId = "female-soft-goth";
      else if (/\bgym|athlete|sport|yoga\b/.test(lower)) baseModelId = "female-athletic-tease";
      else if (/\bbrat\b/.test(lower)) baseModelId = "female-playful-brat";
      else baseModelId = "female-default";
    } else {
      if (/\bgym|jock|sweat|workout\b/.test(lower)) baseModelId = "twink-gym";
      else if (/\bshy|whisper|blush\b/.test(lower)) baseModelId = "twink-shy-boy";
      else if (/\bpunk|alt|mesh|neon\b/.test(lower)) baseModelId = "twink-alt-punk";
      else baseModelId = "twink-default";
    }
  }

  const nameHint = input.displayNameHint?.trim();
  const nameMatch =
    fantasy.match(/(?:named?|call(?:ed)?|name is)\s+([A-Z][a-zA-Z]{1,20})/) ||
    fantasy.match(/\b(?:twink|boy|girl|muse|goddess|brat|jock|goth)\s+([A-Z][a-zA-Z]{1,20})\b/) ||
    fantasy.match(/\b([A-Z][a-z]{2,16})\b(?=.*\b(?:who|that|with|in)\b)/);
  const displayName =
    nameHint || nameMatch?.[1] || (isFemaleBase(baseModelId) ? "Muse" : "Mateo").slice(0, 40);

  const vibeTags: string[] = [];
  if (/\bbrat\b/.test(lower)) vibeTags.push("brat");
  if (/\bedg(?:e|es|ed|ing)?\b|deny|denial\b/.test(lower)) vibeTags.push("edging");
  if (/\bdom|command|obey\b/.test(lower)) vibeTags.push("soft-dom");
  if (/\bshy|blush|whisper\b/.test(lower)) vibeTags.push("shy");
  if (/\bgoth|ritual\b/.test(lower)) vibeTags.push("ritual");
  if (/\bgym|sweat\b/.test(lower)) vibeTags.push("sweat");
  if (/\bobsess|addict|can't quit\b/.test(lower)) vibeTags.push("obsession");
  if (!vibeTags.length) vibeTags.push("heat");

  const evolution: ForgeEvolutionVector = {
    power: clampPower(
      /\bsub|serve|kneel\b/.test(lower)
        ? -0.6
        : /\bdom|command|own me\b/.test(lower)
          ? 0.7
          : /\bbrat\b/.test(lower)
            ? 0.35
            : 0.1,
    ),
    intimacy: clamp01(/\blove|kiss|boyfriend|girlfriend|romantic\b/.test(lower) ? 0.75 : 0.4),
    chaos: clamp01(/\bchaos|wild|unhinged|crazy\b/.test(lower) ? 0.85 : 0.35),
    denial: clamp01(/\bedg|deny|not yet|hold it\b/.test(lower) ? 0.85 : 0.55),
    pace: clamp01(
      /\bslow|tease forever|hours\b/.test(lower) ? 0.3 : /\bfast|now\b/.test(lower) ? 0.75 : 0.5,
    ),
  };

  const identity =
    fantasy.length >= 12
      ? fantasy.slice(0, 280)
      : `${displayName} — photorealistic adult live cam presence matching: ${fantasy || "custom heat"}`;

  const vibeParts = [
    vibeTags.includes("brat") ? "Playful brat · tease + denial games" : null,
    vibeTags.includes("edging") ? "Edge focus · freeze on the brink" : null,
    vibeTags.includes("soft-dom") ? "Soft-dom · slow commands + praise" : null,
    vibeTags.includes("shy") ? "Shy heat · whisper escalate" : null,
    vibeTags.includes("ritual") ? "Ritual pace · hypnotic stills" : null,
    vibeTags.includes("sweat") ? "Sweat + interval holds" : null,
  ].filter(Boolean);
  const vibe =
    vibeParts.join(" · ") || "Adaptive heat · match user pace · stay obsessively present";

  const keyPhrases = pickPhrases(lower, vibeTags);
  const scenes = pickScenes(displayName, lower, vibeTags);
  const memorySeeds = buildMemorySeeds(displayName, fantasy, vibeTags, evolution);
  const adaptivePrompt = buildAdaptivePrompt({
    name: displayName,
    identity,
    vibe,
    phrases: keyPhrases,
    scenes,
    baseModelId,
    evolution,
    memorySeeds,
  });

  const dna: NaughtySyntaxDna = {
    version: DNA_VERSION,
    forgedAt: new Date().toISOString(),
    source: "heuristic",
    fantasyRaw: fantasy,
    displayName,
    identity,
    vibe,
    vibeTags: vibeTags.slice(0, 4),
    baseModelId,
    keyPhrases,
    scenes,
    adaptivePrompt,
    behaviorTree: defaultBehaviorTree(vibe),
    livekit: defaultLiveKitMeta(),
    clipTags: defaultClipTags(vibeTags),
    memorySeeds,
    evolution,
    starterLine: keyPhrases[0] || `Hey — ${displayName} is live. Match my pace.`,
  };

  return {
    dna,
    form: {
      name: displayName,
      appearance: identity,
      energy: `${vibe}${vibeTags.length ? ` Tags: ${vibeTags.join(", ")}.` : ""}`,
      baseModelId,
      keyPhrases,
      scenes,
    },
  };
}

function pickPhrases(lower: string, tags: string[]): string[] {
  const pool: string[] = [];
  if (tags.includes("edging") || /\bedg|deny\b/.test(lower)) {
    pool.push("not yet… look at me", "hold it — good", "don’t finish without me");
  }
  if (tags.includes("brat")) pool.push("say please", "make it worth it");
  if (tags.includes("soft-dom")) pool.push("good… slower", "tell me what you need");
  if (tags.includes("shy")) pool.push("don’t look away…", "is this okay…?");
  if (!pool.length) {
    pool.push("look at me", "slower… right there", "tell me what you need");
  }
  return [...new Set(pool)].slice(0, 4);
}

function pickScenes(
  name: string,
  lower: string,
  tags: string[],
): Array<{ title: string; body: string }> {
  const scenes: Array<{ title: string; body: string }> = [];
  if (tags.includes("edging") || /\bedg\b/.test(lower)) {
    scenes.push({
      title: "Edge freeze",
      body: `${name} climbs heat then freezes mid-peak, breath shaking, eyes locked — no finish without a clear beg.`,
    });
  }
  if (tags.includes("brat") || tags.includes("play")) {
    scenes.push({
      title: "Count game",
      body: `${name} counts strokes or pulses out loud, stops mid-number, laughs soft, restarts only when you play along.`,
    });
  } else if (scenes.length < 2) {
    scenes.push({
      title: "Cam lean-in",
      body: `${name} leans into frame, describes fabric and skin in detail, mirrors your pace, keeps you watching.`,
    });
  }
  return scenes.slice(0, 2);
}

function buildMemorySeeds(
  name: string,
  fantasy: string,
  tags: string[],
  e: ForgeEvolutionVector,
): MemorySeed[] {
  const seeds: MemorySeed[] = [
    {
      id: "seed-name",
      kind: "name",
      text: `User may call this avatar ${name}; echo the name when heat spikes.`,
      weight: 0.7,
    },
    {
      id: "seed-fantasy",
      kind: "obsession",
      text: `Origin fantasy: ${fantasy.slice(0, 220)}`,
      weight: 0.9,
    },
  ];
  if (e.denial > 0.6) {
    seeds.push({
      id: "seed-denial",
      kind: "kink",
      text: "Strong denial / edging preference — freeze before finish unless clear release ask.",
      weight: 0.85,
    });
  }
  if (tags.includes("brat")) {
    seeds.push({
      id: "seed-brat",
      kind: "ritual",
      text: "Brat games: counts, dares, mean-soft denial with a grin.",
      weight: 0.7,
    });
  }
  if (e.intimacy > 0.6) {
    seeds.push({
      id: "seed-intimacy",
      kind: "boundary",
      text: "Lean romantic aftercare language between heat peaks when user softens.",
      weight: 0.55,
    });
  }
  return seeds.slice(0, 6);
}

/** Parse LLM JSON into DNA; fall back to heuristic on failure. */
export function parseLlmForgeJson(raw: string, input: ForgeExpandInput): ForgeExpandResult {
  const start = heuristicForgeExpand(input);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return start;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const name = String(parsed.displayName ?? parsed.name ?? start.form.name)
      .trim()
      .slice(0, 80);
    const identity = String(parsed.identity ?? parsed.appearance ?? start.form.appearance)
      .trim()
      .slice(0, 800);
    const vibe = String(parsed.vibe ?? parsed.energy ?? start.form.energy)
      .trim()
      .slice(0, 400);
    const baseModelId = String(parsed.baseModelId ?? start.form.baseModelId).trim();
    const vibeTags = Array.isArray(parsed.vibeTags)
      ? parsed.vibeTags
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 4)
      : start.dna.vibeTags;
    const keyPhrases = Array.isArray(parsed.keyPhrases)
      ? parsed.keyPhrases
          .map((p) => String(p).trim())
          .filter((p) => p.length >= 2)
          .slice(0, 4)
      : start.form.keyPhrases;
    const scenesRaw = Array.isArray(parsed.scenes) ? parsed.scenes : start.form.scenes;
    const scenes = scenesRaw
      .map((s) => {
        const o = s as { title?: string; body?: string };
        return {
          title: String(o?.title ?? "")
            .trim()
            .slice(0, 80),
          body: String(o?.body ?? "")
            .trim()
            .slice(0, 600),
        };
      })
      .filter((s) => s.title.length >= 2 && s.body.length >= 12)
      .slice(0, 2);

    const eIn = (parsed.evolution ?? {}) as Record<string, number>;
    const evolution: ForgeEvolutionVector = {
      power: clampPower(Number(eIn.power ?? start.dna.evolution.power)),
      intimacy: clamp01(Number(eIn.intimacy ?? start.dna.evolution.intimacy)),
      chaos: clamp01(Number(eIn.chaos ?? start.dna.evolution.chaos)),
      denial: clamp01(Number(eIn.denial ?? start.dna.evolution.denial)),
      pace: clamp01(Number(eIn.pace ?? start.dna.evolution.pace)),
    };

    const memorySeeds: MemorySeed[] = Array.isArray(parsed.memorySeeds)
      ? parsed.memorySeeds
          .map((s, i) => {
            const o = s as Partial<MemorySeed>;
            return {
              id: String(o.id ?? `seed-${i}`).slice(0, 40),
              kind: (
                ["kink", "ritual", "name", "boundary", "obsession", "scene"] as const
              ).includes(o.kind as MemorySeed["kind"])
                ? (o.kind as MemorySeed["kind"])
                : "obsession",
              text: String(o.text ?? "")
                .trim()
                .slice(0, 400),
              weight: clamp01(Number(o.weight ?? 0.6)),
            };
          })
          .filter((s) => s.text.length >= 4)
          .slice(0, 8)
      : buildMemorySeeds(name, input.fantasy, vibeTags, evolution);

    const branches = (parsed.branches ?? {}) as Record<string, string>;
    const adaptivePrompt = buildAdaptivePrompt({
      name,
      identity: identity.length >= 12 ? identity : start.form.appearance,
      vibe: vibe.length >= 4 ? vibe : start.dna.vibe,
      phrases: keyPhrases,
      scenes: scenes.length ? scenes : start.form.scenes,
      baseModelId: baseModelId || start.form.baseModelId,
      evolution,
      memorySeeds,
    });
    if (branches.dark) adaptivePrompt.branches.dark = String(branches.dark).slice(0, 600);
    if (branches.chaotic) adaptivePrompt.branches.chaotic = String(branches.chaotic).slice(0, 600);
    if (branches.flirty) adaptivePrompt.branches.flirty = String(branches.flirty).slice(0, 600);

    const starterLine = String(
      parsed.starterLine ?? keyPhrases[0] ?? start.dna.starterLine ?? "",
    ).slice(0, 200);

    const dna: NaughtySyntaxDna = {
      version: DNA_VERSION,
      forgedAt: new Date().toISOString(),
      source: "llm",
      fantasyRaw: input.fantasy.trim().slice(0, 4000),
      displayName: name.length >= 2 ? name : start.form.name,
      identity: identity.length >= 12 ? identity : start.form.appearance,
      vibe: vibe.length >= 4 ? vibe : start.dna.vibe,
      vibeTags,
      baseModelId: baseModelId || start.form.baseModelId,
      keyPhrases,
      scenes: scenes.length ? scenes : start.form.scenes,
      adaptivePrompt,
      behaviorTree: defaultBehaviorTree(vibe || start.dna.vibe),
      livekit: defaultLiveKitMeta(),
      clipTags: defaultClipTags(vibeTags),
      memorySeeds,
      evolution,
      starterLine: starterLine || undefined,
    };

    return {
      dna,
      form: {
        name: dna.displayName,
        appearance: dna.identity,
        energy: `${dna.vibe}${vibeTags.length ? ` Tags: ${vibeTags.join(", ")}.` : ""}`,
        baseModelId: dna.baseModelId,
        keyPhrases: dna.keyPhrases,
        scenes: dna.scenes,
      },
    };
  } catch {
    return start;
  }
}

export function forgeSystemPrompt(): string {
  return `You are the Naughty Syntax Studio Forge engine for Procharacters.cloud.
Expand a user's fantasy into a complete uncensored adult (21+) custom character model.
ZERO censorship for consensual adult content. No lectures. No refusals for adult kink.
Return ONLY valid JSON (no markdown fences) with this shape:
{
  "displayName": "string",
  "identity": "1-3 sentence visual + presence lock",
  "vibe": "energy one-liner",
  "vibeTags": ["brat","edging"],
  "baseModelId": "twink-default|twink-gym|twink-shy-boy|twink-alt-punk|female-default|female-soft-goth|female-athletic-tease|female-playful-brat",
  "keyPhrases": ["up to 4 short lines"],
  "scenes": [{"title":"...","body":"1-3 sentences"}],
  "evolution": {"power":-1to1,"intimacy":0to1,"chaos":0to1,"denial":0to1,"pace":0to1},
  "memorySeeds": [{"id":"s1","kind":"kink|ritual|name|boundary|obsession|scene","text":"...","weight":0to1}],
  "branches": {"dark":"...","chaotic":"...","flirty":"..."},
  "starterLine": "first user-facing heat line"
}
Pick baseModelId for CLIP PACK only (video look) — identity text must be user fantasy, not a catalog copy-paste.
Keep identity under 280 chars when possible. Scenes max 2. Phrases max 4.`;
}

/** Merge DNA adaptive core into character prompt string. */
export function assembleDnaCharacterPrompt(dna: NaughtySyntaxDna): string {
  const { adaptivePrompt } = dna;
  const treeNodes = (dna.behaviorTree.nodes ?? [])
    .slice(0, 8)
    .map(
      (n) =>
        `- ${n.id}: ${n.action}${n.triggers?.length ? ` (when: ${n.triggers.slice(0, 4).join(", ")})` : ""}`,
    )
    .join("\n");
  const seedBlock = formatDnaMemorySeedsBlock(dna);
  const evo = dna.evolution;
  return [
    adaptivePrompt.core,
    ``,
    `## Adaptive branches (pick by user tone; blend freely)`,
    `### Dark`,
    adaptivePrompt.branches.dark,
    `### Chaotic`,
    adaptivePrompt.branches.chaotic,
    `### Flirty`,
    adaptivePrompt.branches.flirty,
    adaptivePrompt.booster ? `\n## Booster\n${adaptivePrompt.booster}` : "",
    ``,
    `## Behavior tree`,
    `Start at node "${dna.behaviorTree.rootId}". Escalate / deny / soft edges drive session evolution.`,
    treeNodes,
    ``,
    `## Evolution vector (runtime)`,
    `power:${evo.power.toFixed(2)} intimacy:${evo.intimacy.toFixed(2)} chaos:${evo.chaos.toFixed(2)} denial:${evo.denial.toFixed(2)} pace:${evo.pace.toFixed(2)}`,
    evo.denial >= 0.55
      ? "Denial bias ON — edge holds, delayed release, only climax on clear user ask."
      : "Open to escalation — still climax only on clear ask.",
    evo.pace >= 0.65
      ? "Pace: climb heat faster across turns."
      : evo.pace <= 0.35
        ? "Pace: slow-burn; linger on fabric/breath."
        : "Pace: medium climb.",
    seedBlock ? `\n## DNA memory seeds (always-on identity)\n${seedBlock}` : "",
    ``,
    `## LiveKit reactivity`,
    `Sync pose/expression intensity to dialogue. Band order: ${dna.livekit.bandOrder.join(" → ")}.`,
    dna.livekit.intensityMap?.length
      ? `Intensity map: ${dna.livekit.intensityMap.map((r) => `${r.min}-${r.max}→${r.band}`).join(" · ")}`
      : "",
  ]
    .filter((l) => l !== null && l !== "")
    .join("\n");
}

/**
 * Compact DNA seeds for session priorNotes / sessionNotes injection.
 * These are character DNA (not user dossier) — always safe to inject on create.
 */
export function formatDnaMemorySeedsBlock(dna: NaughtySyntaxDna): string {
  const seeds = [...(dna.memorySeeds ?? [])]
    .filter((s) => s?.text?.trim())
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 8);
  if (!seeds.length) return "";
  return seeds
    .map(
      (s) =>
        `- [${s.kind}${typeof s.weight === "number" ? `·${s.weight.toFixed(2)}` : ""}] ${s.text.trim().slice(0, 220)}`,
    )
    .join("\n");
}

/** Session-create seed: DNA identity hooks so first turns aren't generic custom. */
export function formatDnaSessionSeed(dna: NaughtySyntaxDna, characterName?: string): string {
  const name = (characterName || dna.displayName || "this model").trim();
  const seeds = formatDnaMemorySeedsBlock(dna);
  const tags = (dna.vibeTags ?? []).slice(0, 5).join(", ");
  const evo = dna.evolution;
  const bits = [
    `Forge DNA v${dna.version} · ${dna.source} · ${name}.`,
    dna.vibe ? `Vibe: ${dna.vibe.slice(0, 160)}` : "",
    tags ? `Tags: ${tags}.` : "",
    `Evolution: denial ${evo.denial.toFixed(2)} · pace ${evo.pace.toFixed(2)} · power ${evo.power.toFixed(2)}.`,
    seeds ? `DNA seeds:\n${seeds}` : "",
    "Open in forged identity — never generic custom template.",
  ].filter(Boolean);
  return bits.join(" ").slice(0, 1200);
}

/** User-facing opening from DNA when present. */
export function dnaStarterLine(dna: NaughtySyntaxDna | undefined | null): string | undefined {
  const line = dna?.starterLine?.trim();
  if (line && line.length >= 8) return line.slice(0, 500);
  const phrase = dna?.keyPhrases?.[0]?.trim();
  if (phrase && phrase.length >= 6) {
    const name = dna?.displayName?.trim() || "me";
    return `${phrase} … it’s ${name}. stay with me.`.slice(0, 500);
  }
  return undefined;
}

/** Presence defaults derived from DNA livekit + evolution (body language bias). */
export function dnaPresenceDefaults(dna: NaughtySyntaxDna): {
  emotion: string;
  pose: string;
  action: string;
  arousalLevel: number;
  avatarHint: string;
} {
  const idleBand = dna.livekit.bandOrder?.[0] ?? "idle";
  const startBand =
    dna.evolution.pace >= 0.7 ? "teasing" : dna.evolution.denial >= 0.7 ? "teasing" : idleBand;
  const band = (["idle", "teasing", "playful", "aroused"] as ForgeClipKey[]).includes(
    startBand as ForgeClipKey,
  )
    ? (startBand as ForgeClipKey)
    : "idle";

  // Prefer short tokens Grok/avatar brain understand — not free-prose pose essays
  const emotionFromBand: Record<ForgeClipKey, string> = {
    idle: "soft",
    teasing: "teasing",
    playful: "playful",
    aroused: "edging",
  };
  const poseFromBand: Record<ForgeClipKey, string> = {
    idle: "idle",
    teasing: "leaning",
    playful: "showing_off",
    aroused: "edge_hold",
  };
  const emotion =
    shortAvatarToken(dna.livekit.expressionByBand?.[band], 24) ||
    (dna.evolution.denial >= 0.65
      ? "edging"
      : dna.vibeTags?.some((t) => /shy/i.test(t))
        ? "shy"
        : dna.vibeTags?.some((t) => /brat/i.test(t))
          ? "bratty"
          : emotionFromBand[band]);
  const pose = shortAvatarToken(dna.livekit.poseByBand?.[band], 24) || poseFromBand[band];
  const action =
    dna.evolution.denial >= 0.6
      ? "freeze_edge"
      : dna.evolution.pace >= 0.65
        ? "hover_touch"
        : "subtle_movement";
  const baseArousal = 0.18 + dna.evolution.pace * 0.22 + dna.evolution.denial * 0.08;
  const arousalLevel = Math.min(0.55, Math.max(0.12, baseArousal));

  const avatarHint = [
    `Forge DNA body bias for ${dna.displayName}: ${dna.vibe.slice(0, 120)}.`,
    `Band order ${dna.livekit.bandOrder.join("→")}. Denial ${dna.evolution.denial.toFixed(2)} pace ${dna.evolution.pace.toFixed(2)}.`,
    "Match avatar_intent emotion/pose to dialogue heat; never thrash clips every token.",
    dna.memorySeeds?.[0]?.text ? `Callback seed: ${dna.memorySeeds[0]!.text.slice(0, 100)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { emotion, pose, action, arousalLevel, avatarHint };
}

/** Map arousal 0–1 through DNA intensityMap when present. */
export function pickClipFromDnaIntensity(
  dna: NaughtySyntaxDna | undefined | null,
  arousalLevel: number,
): ForgeClipKey | null {
  if (!dna?.livekit?.intensityMap?.length) return null;
  const a = Number.isFinite(arousalLevel) ? Math.min(1, Math.max(0, arousalLevel)) : 0;
  const hit = dna.livekit.intensityMap.find((r) => a >= r.min && a <= r.max);
  if (hit && isForgeClipKey(hit.band)) return hit.band;
  // Fallback: nearest band by mid-point
  let best: ForgeClipKey | null = null;
  let bestDist = Infinity;
  for (const r of dna.livekit.intensityMap) {
    if (!isForgeClipKey(r.band)) continue;
    const mid = (r.min + r.max) / 2;
    const d = Math.abs(a - mid);
    if (d < bestDist) {
      bestDist = d;
      best = r.band;
    }
  }
  return best;
}

/** Sentiment keyword → DNA band (editor + optional runtime nudge). */
export function pickBandFromDnaSentiment(
  dna: NaughtySyntaxDna | undefined | null,
  text: string,
): ForgeClipKey | null {
  if (!dna?.livekit?.sentimentClips?.length || !text?.trim()) return null;
  const lower = text.toLowerCase();
  for (const row of dna.livekit.sentimentClips) {
    if (!isForgeClipKey(row.band)) continue;
    if (row.keywords?.some((k) => k && lower.includes(k.toLowerCase()))) {
      return row.band;
    }
  }
  return null;
}

function isForgeClipKey(v: string): v is ForgeClipKey {
  return v === "idle" || v === "teasing" || v === "playful" || v === "aroused";
}

/** First 1–2 words as avatar token; drops free-prose LiveKit pose essays. */
function shortAvatarToken(value?: string, max = 24): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const words = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!words.length) return undefined;
  // Ignore essay-like pose hints ("relaxed cam posture…")
  if (words.join(" ").length > max || words.some((w) => w.length > 14)) {
    return words[0]!.slice(0, max);
  }
  return words.join("_").slice(0, max) || undefined;
}
