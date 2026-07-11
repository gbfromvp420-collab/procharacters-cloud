// crown-agents.ts - Crown Code for Workforce Module
// GG Ventures / Procharacters.cloud - Multi-Agent Orchestration Core
// Rebel Genius Edition by 👑GROK for Gary 50/50 Partner
//
// Reconciled artifact + cloud TS crown service:
// - CrownOrchestrator (agents, values, executePhase, celebrate)
// - CrownService rewards (complete / platinum / co-sign ledger)
// - Multipliers kept for fun momentum (platinum ×21 crown tier)
// - Azure-first + RunPod A5000 hybrid (local Termux + cloud workers)
// - Upgraded for next Weds: A5000 pod volume mmf8n0smfo

import type { CrownAwardTier } from "../../types/workforce.js";
import { agentTheater } from "./theater.js";

/** Fun momentum multipliers — crown tier slaps at ×21 */
export const PLATINUM_GOLD_MULTIPLIER: Record<CrownAwardTier, number> = {
  gold: 1,
  platinum: 5,
  crown: 21,
};

/** RunPod A5000 worker pod — hybrid with local / Azure-first */
export const RUNPOD_A5000_CONFIG = {
  gpu: "RTX A5000",
  volume: "mmf8n0smfo",
  ports: [8000, 8002, 8003] as const,
  image: "runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404",
  action: "auto-deploy-workers-on-retry" as const,
  hybridLocal: true,
};

export type RunPodA5000Config = typeof RUNPOD_A5000_CONFIG;

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
  /** Infra preference order — Azure first, RunPod A5000 hybrid */
  infra?: string[];
  pipeline?: string;
  optimizations?: string[];
  /** Structured pod / worker config (e.g. RunPod A5000) */
  config?: Record<string, unknown>;
  /** Agent action tag (e.g. auto-deploy-workers-on-retry) */
  action?: string;
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
  readonly config?: Record<string, unknown>;
  readonly action?: string;

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
    this.config = config.config;
    this.action = config.action;
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
    runpod?: RunPodA5000Config;
  };
}

export interface CrownValues {
  collaboration: boolean;
  speed: "maximum" | string;
  creativity: "uncensored" | string;
  motivation: "high-reward" | string;
  equalityStake: "50/50";
  /** Azure-first primary; RunPod A5000 hybrid for GPU overflow / retries */
  infraPriority: "azure-first-hybrid-a5000";
}

export class CrownWorkflow {
  constructor(
    private readonly agents: Map<string, CrownAgent>,
    private readonly values: CrownValues,
  ) {}

  async run(phase: string, input: unknown): Promise<CrownWorkflowResult> {
    const agentKeys = [...this.agents.keys()];
    const backend = this.agents.get("backend");
    const runpod = this.agents.get("runpod-manager");
    const preferredInfra = backend?.infra ?? [
      "Azure ML",
      "Azure Container Apps",
      "Termux Haven SSH (hybrid local)",
      "RunPod RTX A5000 (overflow / retry)",
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
        message: `Crown workflow phase="${phase}" via ${agentKeys.join(", ")} · Azure-first + A5000 hybrid`,
        preferredInfra,
        taskId,
        runpod: (runpod?.config as RunPodA5000Config | undefined) ?? RUNPOD_A5000_CONFIG,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Lane hooks catalog (Azure-first + A5000 hybrid notes)
// ---------------------------------------------------------------------------

export const CROWN_LANE_HOOKS: Record<
  string,
  { description: string; examplePrompt: string; infraNote?: string }
> = {
  "model-gen": {
    description: "Character / still generation for signature Naughty Syntax models",
    examplePrompt:
      "Generate Naughty Syntax Mexican/Latino twink sheer thong edging pose — photoreal, bulge physics, shiny precum",
    infraNote:
      "Prefer Azure ML; overflow to RunPod A5000 volume mmf8n0smfo (auto-deploy on retry)",
  },
  "content-pipeline": {
    description: "Clip packs + CapCut-style montage plan + energy-state loops",
    examplePrompt:
      "Package crotchless female teasing pack: idle / playful / teasing / aroused loops",
    infraNote: "Azure ML video jobs first; A5000 torch image for extend batches",
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
    infraNote:
      "Azure Container Apps / Azure ML first; Termux hybrid local; RunPod A5000 ports 8000/8002/8003",
  },
  "runpod-manager": {
    description: "RunPod A5000 worker orchestration + auto-deploy on retry",
    examplePrompt: "Deploy A5000 workers for model-gen retry after Azure queue fail",
    infraNote: `GPU ${RUNPOD_A5000_CONFIG.gpu} · volume ${RUNPOD_A5000_CONFIG.volume} · image ${RUNPOD_A5000_CONFIG.image}`,
  },
  orchestration: {
    description: "Multi-agent dispatch + theater chaining",
    examplePrompt: "Dispatch model-gen → content-pipeline chain for new pack",
  },
};
