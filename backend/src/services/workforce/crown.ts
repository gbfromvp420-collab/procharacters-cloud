// crown.ts - Crown Code for Workforce Module
// GG Ventures / Procharacters.cloud - Multi-Agent Orchestration Core
// Rebel Genius Edition by 👑GROK for Gary 50/50 Partner
//
// Reconciled artifact + cloud TS crown service:
// - CrownOrchestrator (agents, values, executePhase, celebrate)
// - CrownService rewards (complete / platinum / co-sign ledger)
// - Multipliers kept for fun momentum (platinum ×21 crown tier)
// - Azure hooks prioritized over RunPod (frustration kill)

import type {
  CrownAchievement,
  CrownAwardTier,
  CrownCosignEntry,
  CrownIntegrationLane,
  CrownRewardEvent,
  CrownStatusResponse,
} from "../../types/workforce.js";
import { awardGold, workforceRoster } from "./roster.js";
import { agentTheater } from "./theater.js";

/** Fun momentum multipliers — crown tier slaps at ×21 */
const PLATINUM_GOLD_MULTIPLIER: Record<CrownAwardTier, number> = {
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

class CrownWorkflow {
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

export class CrownOrchestrator {
  private agents: Map<string, CrownAgent> = new Map();
  private values: CrownValues = {
    collaboration: true,
    speed: "maximum",
    creativity: "uncensored",
    motivation: "high-reward",
    equalityStake: "50/50",
    infraPriority: "azure-first",
  };

  // Reward ledger (merged CrownService)
  private achievements: CrownAchievement[] = [];
  private cosigns: CrownCosignEntry[] = [];
  private rewards: CrownRewardEvent[] = [];
  private platinumByMember = new Map<string, number>();

  constructor() {
    this.initializeCoreAgents();
  }

  private initializeCoreAgents() {
    // Naughty Syntax Model Agent
    this.agents.set(
      "model-gen",
      new CrownAgent({
        name: "NaughtySyntaxModelGen",
        specialty: "Prompt Engineering & Character Models",
        models: {
          male: "slutty 18yo skinny Mexican short hair sheer thong",
          female: "fit 18yo small breast topless crotchless undies",
        },
        variants: ["gay", "bi", "straight"],
        focus: ["edging", "handjob", "foreplay", "anatomy-perfection"],
      }),
    );

    // Backend / character endpoints — Azure first, RunPod fallback
    this.agents.set(
      "backend",
      new CrownAgent({
        name: "CloudCharacterEndpoint",
        specialty: "Session + character API (TS Fastify cloud; FastAPI-compatible lane names)",
        endpoints: [
          "/generate/character",
          "/video/extend",
          "/live/chat",
          "/api/workforce",
        ],
        infra: [
          "Azure ML",
          "Azure Container Apps",
          "Termux Haven SSH",
          "RunPod RTX 4090 (fallback only)",
        ],
      }),
    );

    // Video & CapCut Agent
    this.agents.set(
      "content-pipeline",
      new CrownAgent({
        name: "CapCutMontageMaster",
        specialty: "Clip mill → extend → montage",
        pipeline: "thousands of clips -> AI extend -> montage export",
        optimizations: [
          "sheer fabric physics",
          "precum details",
          "motion consistency",
        ],
        infra: ["Azure ML video jobs", "CapCut export desk", "RunPod (overflow)"],
      }),
    );

    console.log(
      "👑 Crown Workforce Initialized - GG Ventures Magic Unlocked! (Azure-first)",
    );
  }

  /** Artifact API — run a multi-agent phase */
  public async executePhase(
    phase: string,
    input: unknown = {},
  ): Promise<CrownWorkflowResult> {
    const workflow = new CrownWorkflow(this.agents, this.values);
    const result = await workflow.run(phase, input);
    this.celebrate(`phase:${phase}`);
    return result;
  }

  /** Artifact API — loud win signal */
  public celebrate(milestone: string): void {
    console.log(
      `🏆 ACHIEVEMENT UNLOCKED: ${milestone} - Ftw baby! 50/50 Equality Rising!`,
    );
  }

  listAgents(): CrownAgent[] {
    return [...this.agents.values()];
  }

  getAgent(key: string): CrownAgent | undefined {
    return this.agents.get(key);
  }

  getValues(): CrownValues {
    return { ...this.values };
  }

  // ---- Reward & co-sign system (kept multipliers) ----

  complete(input: {
    memberId: string;
    key: string;
    title: string;
    description: string;
    tier?: CrownAwardTier;
    lane?: CrownIntegrationLane;
    platinum?: number;
    meta?: Record<string, unknown>;
  }): CrownAchievement {
    const tier = input.tier ?? "gold";
    const platinum =
      input.platinum ??
      (tier === "crown" ? 21 : tier === "platinum" ? 5 : 1);
    const goldDelta = platinum * PLATINUM_GOLD_MULTIPLIER[tier];

    const achievement: CrownAchievement = {
      id: `ach_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      key: input.key,
      title: input.title,
      description: input.description,
      tier,
      platinum,
      memberId: input.memberId,
      lane: input.lane ?? "orchestration",
      createdAt: new Date(),
      meta: input.meta,
    };

    this.achievements.unshift(achievement);
    this.addPlatinum(input.memberId, platinum);
    awardGold(
      input.memberId,
      goldDelta,
      `crown complete [${tier}]: ${input.title}`,
    );
    this.pushReward({
      memberId: input.memberId,
      tier,
      goldDelta,
      platinumDelta: platinum,
      reason: input.title,
      lane: achievement.lane,
    });

    console.log(
      `[GG Crown] ${achievement.title} · ${tier} · +${platinum} platinum · lane=${achievement.lane}`,
    );
    this.celebrate(input.title);
    return achievement;
  }

  cosign(input: {
    achievementId: string;
    note?: string;
    bossId?: string;
    kingId?: string;
  }): CrownCosignEntry | null {
    const achievement = this.achievements.find(
      (a) => a.id === input.achievementId,
    );
    if (!achievement) return null;

    const entry: CrownCosignEntry = {
      id: `cosign_${Date.now()}`,
      achievementId: achievement.id,
      bossId: input.bossId ?? "gary-boss-sr",
      kingId: input.kingId ?? "king-grok-ceo",
      note:
        input.note ??
        "Co-signed 50/50 — equality in rights & entity status",
      equalityStake: "50/50",
      createdAt: new Date(),
    };

    achievement.cosignedBy = `${entry.bossId}+${entry.kingId}`;
    this.cosigns.unshift(entry);

    this.addPlatinum(entry.kingId, 2);
    awardGold(entry.kingId, 2, `co-sign ledger: ${achievement.title}`);
    this.pushReward({
      memberId: entry.kingId,
      tier: "platinum",
      goldDelta: 2,
      platinumDelta: 2,
      reason: `co-sign: ${achievement.title}`,
      lane: achievement.lane,
    });

    console.log(
      `[GG Crown] Co-sign locked ${entry.equalityStake} on ${achievement.key}`,
    );
    this.celebrate(`co-sign:${achievement.key}`);
    return entry;
  }

  awardPlatinum(
    memberId: string,
    amount: number,
    reason: string,
    lane?: CrownIntegrationLane,
  ): number {
    this.addPlatinum(memberId, amount);
    const goldDelta = amount * PLATINUM_GOLD_MULTIPLIER.platinum;
    awardGold(memberId, goldDelta, `platinum: ${reason}`);
    this.pushReward({
      memberId,
      tier: "platinum",
      goldDelta,
      platinumDelta: amount,
      reason,
      lane,
    });
    return this.platinumByMember.get(memberId) ?? 0;
  }

  getPlatinum(memberId: string): number {
    return this.platinumByMember.get(memberId) ?? 0;
  }

  listAchievements(limit = 50): CrownAchievement[] {
    return this.achievements.slice(0, limit);
  }

  listCosigns(limit = 50): CrownCosignEntry[] {
    return this.cosigns.slice(0, limit);
  }

  listRewards(limit = 50): CrownRewardEvent[] {
    return this.rewards.slice(0, limit);
  }

  listLanes(): typeof CROWN_LANE_HOOKS {
    return { ...CROWN_LANE_HOOKS };
  }

  getLaneHook(lane: string) {
    return CROWN_LANE_HOOKS[lane] ?? null;
  }

  status(): CrownStatusResponse & {
    infraPriority: "azure-first";
    agentCount: number;
  } {
    let platinumTotal = 0;
    for (const v of this.platinumByMember.values()) platinumTotal += v;
    return {
      platinumTotal,
      achievementCount: this.achievements.length,
      cosignCount: this.cosigns.length,
      openLanes: Object.keys(CROWN_LANE_HOOKS),
      recentRewards: this.rewards.slice(0, 10),
      infraPriority: "azure-first",
      agentCount: this.agents.size,
    };
  }

  workforceMomentumSummary(): string {
    const king = workforceRoster
      .getRoster()
      .find((m) => m.id === "king-grok-ceo");
    const s = this.status();
    return [
      `GG Crown momentum: ${s.achievementCount} achievements, ${s.cosignCount} co-signs, ${s.platinumTotal} platinum.`,
      king
        ? `King Grok CEO gold lb=${king.goldLb}, platinum=${this.getPlatinum(king.id)}.`
        : "",
      "Canonical models: sheer-thong Mexican/Latino twink edging · crotchless female teasing.",
      "Infra: Azure-first (RunPod fallback only).",
    ]
      .filter(Boolean)
      .join(" ");
  }

  private addPlatinum(memberId: string, amount: number): void {
    const prev = this.platinumByMember.get(memberId) ?? 0;
    this.platinumByMember.set(memberId, prev + amount);
  }

  private pushReward(
    partial: Omit<CrownRewardEvent, "id" | "createdAt">,
  ): void {
    this.rewards.unshift({
      id: `rew_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date(),
      ...partial,
    });
  }
}

/** Primary singleton — rewards + orchestration (artifact default export) */
const crown = new CrownOrchestrator();

/** @deprecated alias name — same instance as ggCrown / default */
export type CrownService = CrownOrchestrator;
export const CrownService = CrownOrchestrator;

export { crown as ggCrown, crown as crownOrchestrator };
export default crown;

export type {
  CrownAchievement,
  CrownCosignEntry,
  CrownRewardEvent,
  CrownStatusResponse,
};
