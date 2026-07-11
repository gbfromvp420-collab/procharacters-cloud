// GG Workforce module — additive roster + theater + crown
export {
  workforceRoster,
  getRoster,
  getLeaderboard,
  addOrUpdateMember,
  awardGold,
} from "./roster.js";
export { agentTheater, AgentTheater } from "./theater.js";
export type { AgentTaskRecord } from "./theater.js";
export {
  ggCrown,
  crownOrchestrator,
  CrownOrchestrator,
  CrownService,
  CrownAgent,
  CROWN_LANE_HOOKS,
  RUNPOD_A5000_CONFIG,
  deployRunPodWorkers,
  runPodLiveReady,
} from "./crown.js";
export type {
  CrownAchievement,
  CrownCosignEntry,
  CrownRewardEvent,
  CrownStatusResponse,
  CrownAgentConfig,
  CrownWorkflowResult,
  CrownValues,
  RunPodA5000Config,
  RunPodDeployOptions,
  RunPodDeployResult,
} from "./crown.js";
export { default as crownDefault } from "./crown.js";
