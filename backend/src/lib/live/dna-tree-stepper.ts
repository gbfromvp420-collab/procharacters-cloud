/**
 * Soft behavior-tree stepper for Studio Forge DNA (custom-v3).
 * Advances spark → tease → edge → deny / release-gate from user language + turn heat.
 * Soft only — never hard-blocks climax; prompt bias + avatar nudge.
 */

import type {
  BehaviorTree,
  BehaviorTreeNode,
  ForgeEvolutionVector,
  NaughtySyntaxDna,
} from "./forge-dna.js";

export type DnaTreeEdgeKind = "escalate" | "soft" | "deny" | "stay";

export interface DnaTreeStep {
  nodeId: string;
  node: BehaviorTreeNode;
  previousNodeId?: string;
  edge: DnaTreeEdgeKind;
  /** True when node changed this turn. */
  advanced: boolean;
  /** Prompt block for LLM. */
  promptBlock: string;
  /** Avatar body nudge. */
  avatarBias: {
    emotion?: string;
    pose?: string;
    action?: string;
    arousalFloor?: number;
    arousalCeiling?: number;
  };
  /** UI: short label + fire seeds. */
  ui: {
    label: string;
    fireLine: string;
    chips: string[];
  };
}

const GLOBAL_ESCALATE =
  /\b(more|harder|faster|please|deeper|hotter|show me|take me|need you|want you|don't stop|dont stop|keep going|yes|fuck|stroke|touch)\b/i;
const GLOBAL_DENY =
  /\b(stop|not yet|don't cum|dont cum|hold|deny|edge|wait|slow down|no finish|don't finish|dont finish)\b/i;
const GLOBAL_SOFT =
  /\b(slow|gentle|soft|kiss|hold me|cuddle|whisper|sweet|easy|breathe)\b/i;
const GLOBAL_RELEASE =
  /\b(cum|finish|let me cum|make me cum|release|i'?m close|gonna cum|can i cum|let me finish)\b/i;

function nodeMap(tree: BehaviorTree): Map<string, BehaviorTreeNode> {
  const m = new Map<string, BehaviorTreeNode>();
  for (const n of tree.nodes ?? []) {
    if (n?.id) m.set(n.id, n);
  }
  return m;
}

function resolveNode(
  tree: BehaviorTree,
  id: string | undefined | null,
): BehaviorTreeNode | null {
  const map = nodeMap(tree);
  if (id && map.has(id)) return map.get(id)!;
  if (tree.rootId && map.has(tree.rootId)) return map.get(tree.rootId)!;
  return tree.nodes?.[0] ?? null;
}

function scoreTriggers(node: BehaviorTreeNode, lower: string): number {
  let score = 0;
  for (const t of node.triggers ?? []) {
    const token = t.trim().toLowerCase();
    if (token && lower.includes(token)) score += 2;
  }
  return score;
}

/**
 * Classify intended edge from user text + evolution, then walk tree edges.
 */
export function classifyDnaTreeIntent(
  userMessage: string,
  evolution?: ForgeEvolutionVector,
): DnaTreeEdgeKind {
  const text = userMessage.trim();
  if (!text) return "stay";

  const denialBias = evolution?.denial ?? 0.5;
  const pace = evolution?.pace ?? 0.5;

  if (GLOBAL_RELEASE.test(text)) {
    // High denial → treat release beg as escalate toward gate, not free finish
    return denialBias >= 0.55 ? "escalate" : "escalate";
  }
  if (GLOBAL_DENY.test(text)) return "deny";
  if (GLOBAL_SOFT.test(text) && !GLOBAL_ESCALATE.test(text)) return "soft";
  if (GLOBAL_ESCALATE.test(text)) return "escalate";

  // Passive turns: pace can still climb slowly
  if (pace >= 0.7 && text.length > 12) return "escalate";
  if (pace <= 0.3 && text.length > 8) return "soft";
  return "stay";
}

function walkEdge(
  node: BehaviorTreeNode,
  edge: DnaTreeEdgeKind,
  map: Map<string, BehaviorTreeNode>,
): { next: BehaviorTreeNode; edge: DnaTreeEdgeKind } {
  if (edge === "stay") return { next: node, edge: "stay" };

  const targetId =
    edge === "escalate"
      ? node.edges?.escalate
      : edge === "deny"
        ? node.edges?.deny ?? node.edges?.soft
        : node.edges?.soft;

  if (targetId && map.has(targetId)) {
    return { next: map.get(targetId)!, edge };
  }

  // Soft fallbacks when edge missing
  if (edge === "deny" && node.edges?.soft && map.has(node.edges.soft)) {
    return { next: map.get(node.edges.soft)!, edge: "soft" };
  }
  if (edge === "escalate" && node.edges?.deny && map.has(node.edges.deny)) {
    // release-gate missing → stay / deny loop
    return { next: node, edge: "stay" };
  }
  return { next: node, edge: "stay" };
}

/** Auto-climb on high turn count when user is engaged but not directing. */
function heatAutoClimb(
  nodeId: string,
  turnCount: number,
  edge: DnaTreeEdgeKind,
  evolution?: ForgeEvolutionVector,
): DnaTreeEdgeKind {
  if (edge !== "stay") return edge;
  const pace = evolution?.pace ?? 0.5;
  const threshold = pace >= 0.65 ? 2 : pace <= 0.35 ? 5 : 3;
  if (turnCount >= threshold && (nodeId === "spark" || nodeId === "soft-lock")) {
    return "escalate";
  }
  if (turnCount >= threshold + 3 && nodeId === "tease") {
    return evolution?.denial && evolution.denial >= 0.5 ? "escalate" : "escalate";
  }
  return edge;
}

export function avatarBiasForTreeNode(node: BehaviorTreeNode): DnaTreeStep["avatarBias"] {
  const id = node.id.toLowerCase();
  if (id.includes("release")) {
    return {
      emotion: "breathless",
      pose: "edge_hold",
      action: "stroke_over_fabric",
      arousalFloor: 0.78,
    };
  }
  if (id.includes("deny")) {
    return {
      emotion: "edging",
      pose: "leaning",
      action: "freeze_edge",
      arousalFloor: 0.62,
      arousalCeiling: 0.88,
    };
  }
  if (id.includes("edge")) {
    return {
      emotion: "edging",
      pose: "edge_hold",
      action: "freeze_edge",
      arousalFloor: 0.7,
    };
  }
  if (id.includes("tease")) {
    return {
      emotion: "teasing",
      pose: "leaning",
      action: "hover_touch",
      arousalFloor: 0.38,
    };
  }
  if (id.includes("soft")) {
    return {
      emotion: "soft",
      pose: "idle",
      action: "subtle_movement",
      arousalFloor: 0.22,
      arousalCeiling: 0.55,
    };
  }
  // spark / default
  return {
    emotion: "teasing",
    pose: "idle",
    action: "subtle_movement",
    arousalFloor: 0.2,
  };
}

export function uiForTreeNode(node: BehaviorTreeNode): DnaTreeStep["ui"] {
  const id = node.id.toLowerCase();
  if (id.includes("release")) {
    return {
      label: node.label || "Release gate",
      fireLine: "please… let me",
      chips: ["please let me", "i need it", "not yet hold me"],
    };
  }
  if (id.includes("deny")) {
    return {
      label: node.label || "Denial",
      fireLine: "not yet — hold",
      chips: ["not yet", "deny me", "edge harder"],
    };
  }
  if (id.includes("edge")) {
    return {
      label: node.label || "Edge",
      fireLine: "stay right there",
      chips: ["edge me", "don't stop", "so close"],
    };
  }
  if (id.includes("tease")) {
    return {
      label: node.label || "Tease",
      fireLine: "show me more",
      chips: ["tease me", "more", "slow stroke"],
    };
  }
  if (id.includes("soft")) {
    return {
      label: node.label || "Soft lock",
      fireLine: "go slow with me",
      chips: ["slow", "whisper", "kiss me"],
    };
  }
  return {
    label: node.label || "Spark",
    fireLine: "look at me",
    chips: ["hey", "come closer", "start slow"],
  };
}

export function formatDnaTreePromptBlock(step: DnaTreeStep): string {
  const n = step.node;
  return [
    "## Forge DNA behavior tree (live)",
    `Active node: **${n.id}** — ${n.label}`,
    `Directive: ${n.action}`,
    n.triggers?.length ? `Node triggers: ${n.triggers.slice(0, 6).join(", ")}` : "",
    n.edges
      ? `Edges: escalate→${n.edges.escalate ?? "—"} · soft→${n.edges.soft ?? "—"} · deny→${n.edges.deny ?? "—"}`
      : "",
    step.advanced
      ? `Just moved from ${step.previousNodeId ?? "?"} via ${step.edge} — soft name the shift in character voice.`
      : `Hold this node energy unless the user clearly redirects.`,
    "Soft stepper only: stay in identity; climax only on clear user ask; never hard-reset the scene.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Advance (or hold) the DNA behavior tree for one user turn.
 */
export function stepDnaBehaviorTree(input: {
  dna: NaughtySyntaxDna;
  currentNodeId?: string | null;
  userMessage: string;
  /** Approx completed turns before this user message. */
  turnCount?: number;
}): DnaTreeStep {
  const tree = input.dna.behaviorTree;
  const map = nodeMap(tree);
  const current = resolveNode(tree, input.currentNodeId);
  if (!current) {
    const fallback: BehaviorTreeNode = {
      id: "spark",
      label: "Spark",
      triggers: [],
      action: "Open in character and escalate with the user",
    };
    const step: DnaTreeStep = {
      nodeId: fallback.id,
      node: fallback,
      edge: "stay",
      advanced: false,
      promptBlock: "",
      avatarBias: avatarBiasForTreeNode(fallback),
      ui: uiForTreeNode(fallback),
    };
    step.promptBlock = formatDnaTreePromptBlock(step);
    return step;
  }

  const lower = input.userMessage.toLowerCase();
  let edge = classifyDnaTreeIntent(input.userMessage, input.dna.evolution);

  // If user hits another node's triggers harder, jump soft toward best match
  let bestOther: { node: BehaviorTreeNode; score: number } | null = null;
  for (const n of map.values()) {
    if (n.id === current.id) continue;
    const s = scoreTriggers(n, lower);
    if (s >= 2 && (!bestOther || s > bestOther.score)) {
      bestOther = { node: n, score: s };
    }
  }

  const turnCount = input.turnCount ?? 0;
  edge = heatAutoClimb(current.id, turnCount, edge, input.dna.evolution);

  // Clear release beg on release-gate or edge → prefer escalate to gate / deny
  if (GLOBAL_RELEASE.test(input.userMessage)) {
    if (current.id === "release-gate" || current.edges?.escalate === "release-gate") {
      edge = "escalate";
    } else if (current.edges?.deny && (input.dna.evolution?.denial ?? 0) >= 0.7) {
      edge = "deny";
    }
  }

  let next = current;
  let usedEdge: DnaTreeEdgeKind = edge;

  if (bestOther && bestOther.score >= 4 && bestOther.node.id !== current.id) {
    // Strong trigger match on another node → soft jump
    next = bestOther.node;
    usedEdge = "escalate";
  } else {
    const walked = walkEdge(current, edge, map);
    next = walked.next;
    usedEdge = walked.edge;
  }

  const advanced = next.id !== current.id;
  const step: DnaTreeStep = {
    nodeId: next.id,
    node: next,
    previousNodeId: advanced ? current.id : undefined,
    edge: usedEdge,
    advanced,
    promptBlock: "",
    avatarBias: avatarBiasForTreeNode(next),
    ui: uiForTreeNode(next),
  };
  step.promptBlock = formatDnaTreePromptBlock(step);
  return step;
}

/** Initial node id for session create. */
export function initialDnaTreeNodeId(dna: NaughtySyntaxDna | undefined | null): string | undefined {
  if (!dna?.behaviorTree?.rootId) return undefined;
  const map = nodeMap(dna.behaviorTree);
  if (map.has(dna.behaviorTree.rootId)) return dna.behaviorTree.rootId;
  return dna.behaviorTree.nodes?.[0]?.id;
}
