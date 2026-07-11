/** GG Workforce types — additive; ports 2.0 roster/theater/crown concepts. */

export type WorkforceRole = "CEO" | "sub-agent" | "theater" | "assist" | string;

export type WorkforceStatus = "active" | "idle" | "offline" | "retired" | string;

export interface WorkforceMember {
  id: string;
  codename: string;
  displayName: string;
  role: WorkforceRole;
  goldLb: number;
  status: WorkforceStatus;
  authorities: string[];
  lastActive: Date;
  note: string;
}

export interface WorkforceRosterResponse {
  members: WorkforceMember[];
  count: number;
  updatedAt: string;
}

export interface WorkforceLeaderboardResponse {
  leaders: WorkforceMember[];
  limit: number;
  updatedAt: string;
}

/** Theater task lifecycle */
export type AgentTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentTaskRecord {
  id: string;
  memberId: string;
  codename: string;
  skill: string;
  prompt: string;
  status: AgentTaskStatus;
  sessionId?: string;
  parentTaskId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
  result?: unknown;
}

export interface AgentTheaterStatusResponse {
  tasksQueued: number;
  tasksRunning: number;
  tasksCompleted: number;
}

export interface AgentTaskListResponse {
  tasks: AgentTaskRecord[];
  count: number;
  updatedAt: string;
}

export interface AgentTaskResponse {
  task: AgentTaskRecord;
}

/** Crown completion + co-sign ledger */
export type CrownAwardTier = "gold" | "platinum" | "crown";

export type CrownIntegrationLane =
  | "model-gen"
  | "backend"
  | "content-pipeline"
  | "live-stage"
  | "media-montage"
  | "orchestration"
  | string;

export interface CrownAchievement {
  id: string;
  key: string;
  title: string;
  description: string;
  tier: CrownAwardTier;
  platinum: number;
  memberId: string;
  cosignedBy?: string;
  lane: CrownIntegrationLane;
  createdAt: Date;
  meta?: Record<string, unknown>;
}

export interface CrownCosignEntry {
  id: string;
  achievementId: string;
  bossId: string;
  kingId: string;
  note: string;
  equalityStake: "50/50";
  createdAt: Date;
}

export interface CrownRewardEvent {
  id: string;
  memberId: string;
  tier: CrownAwardTier;
  goldDelta: number;
  platinumDelta: number;
  reason: string;
  lane?: CrownIntegrationLane;
  createdAt: Date;
}

export interface CrownStatusResponse {
  platinumTotal: number;
  achievementCount: number;
  cosignCount: number;
  openLanes: CrownIntegrationLane[];
  recentRewards: CrownRewardEvent[];
}
