// crown.ts - Crown Code for Workforce Module
// GG Ventures / Procharacters.cloud - Multi-Agent Orchestration Core
// Rebel Genius Edition by 👑GROK for Gary 50/50 Partner
//
// Reconciled artifact + cloud TS crown service:
// - CrownOrchestrator (agents, values, executePhase, celebrate)
// - CrownService rewards (complete / platinum / co-sign ledger)
// - Multipliers kept for fun momentum (platinum ×21 crown tier)
// - Azure hooks prioritized over RunPod (frustration kill)

import type { CrownAwardTier } from "../../types/workforce.js";
import { agentTheater } from "./theater.js";

/** Fun momentum multipliers — crown tier slaps at ×21 */
export const PLATINUM_GOLD_MULTIPLIER: Record<CrownAwardTier, number> = {
  gold: 1,
  platinum: 5,
  crown: 21,
};

// ---------------------------------------------------------------------------
// Artifact-style agent / workflow primitives (local to crown — no broken imports)
// ---------------------------------------------------------------------------

export interface CrownAgentConfig {
  name: string;
  specialty?: string;
  models?: { male: string; female: string };
  variants?: string[];
  focus?: string[];
  endpoints?: string[];
  /** Infra preference order — Azure first, RunPod secondary */
  infra?: string[];
  pipeline?: string;
  optimizations?: string[];
}

export class CrownAgent {
  readonly name: string;
  readonly specialty?: string;
  readonly models?: { male: string; female: string };
  readonly variants?: string[];
  readonly focus?: string[];
  readonly endpoints?: string[];
  readonly infra?: string[];
  readonly pipeline?: string;
  readonly optimizations?: string[];

  constructor(config: CrownAgentConfig) {
    this.name = config.name;
    this.specialty = config.specialty;
    this.models = config.models;
    this.variants = config.variants;
    this.focus = config.focus;
    this.endpoints = config.endpoints;
    this.infra = config.infra;
    this.pipeline = config.pipeline;
    this.optimizations = config.optimizations;
  }
}

export interface CrownWorkflowResult {
  phase: string;
  agentKeys: string[];
  values: CrownValues;
  input: unknown;
  output: {
    status: "planned" | "dispatched";
    message: string;
    preferredInfra: string[];
    taskId?: string;
  };
}

export interface CrownValues {
  collaboration: boolean;
  speed: "maximum" | string;
  creativity: "uncensored" | string;
  motivation: "high-reward" | string;
  equalityStake: "50/50";
  infraPriority: "azure-first";
}

export class CrownWorkflow {
  constructor(
    private readonly agents: Map<string, CrownAgent>,
    private readonly values: CrownValues,
  ) {}

  async run(phase: string, input: unknown): Promise<CrownWorkflowResult> {
    const agentKeys = [...this.agents.keys()];
    const backend = this.agents.get("backend");
    const preferredInfra = backend?.infra ?? [
      "Azure ML",
      "Azure Container Apps",
      "RunPod RTX 4090 (fallback)",
    ];

    // Optional theater dispatch when phase matches a known lane
    let taskId: string | undefined;
    if (this.agents.has(phase)) {
      const prompt =
        typeof input === "object" &&
        input !== null &&
        "prompt" in input &&
        typeof (input as { prompt: unknown }).prompt === "string"
          ? (input as { prompt: string }).prompt
          : `Crown phase: ${phase}`;
      const task = await agentTheater.dispatch(
        "king-grok-ceo",
        prompt,
        phase,
      );
      taskId = task.id;
    }

    return {
      phase,
      agentKeys,
      values: this.values,
      input,
      output: {
        status: taskId ? "dispatched" : "planned",
        message: `Crown workflow phase="${phase}" via ${agentKeys.join(", ")} · infra priority Azure-first`,
        preferredInfra,
        taskId,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Lane hooks catalog (Azure-first notes)
// ---------------------------------------------------------------------------

export const CROWN_LANE_HOOKS: Record<
  string,
  { description: string; examplePrompt: string; infraNote?: string }
> = {
  "model-gen": {
    description: "Character / still generation for signature Naughty Syntax models",
    examplePrompt:
      "Generate Naughty Syntax Mexican/Latino twink sheer thong edging pose — photoreal, bulge physics, shiny precum",
    infraNote: "Prefer Azure ML endpoints; RunPod only if Azure queue fails",
  },
  "content-pipeline": {
    description: "Clip packs + CapCut-style montage plan + energy-state loops",
    examplePrompt:
      "Package crotchless female teasing pack: idle / playful / teasing / aroused loops",
  },
  "live-stage": {
    description: "Future live stage hooks (no LiveKit changes yet)",
    examplePrompt: "Stage hook: attach avatar energy state to session turn",
  },
  "media-montage": {
    description: "CapCut montage export plan (stub)",
    examplePrompt: "Montage plan: 6s edging beats + French-kiss cutaways",
  },
  backend: {
    description: "Backend / session / character API integration wins",
    examplePrompt: "Wire workforce status route without breaking sessions API",
    infraNote: "Azure Container Apps / Azure ML first; Termux Haven SSH for ops; RunPod fallback",
  },
  orchestration: {
    description: "Multi-agent dispatch + theater chaining",
    examplePrompt: "Dispatch model-gen → content-pipeline chain for new pack",
  },
};

// ---------------------------------------------------------------------------
// CrownOrchestrator (artifact) + reward ledger (cloud service)
// ---------------------------------------------------------------------------

