// backend/src/services/workforce/theater.ts
// GG Agent Theater — dispatch, task chaining, progress tracking
// Additive only — hooks into existing chat-orchestrator and session-manager later

import type {
  AgentTaskRecord,
  AgentTheaterStatusResponse,
} from "../../types/workforce.js";
import { awardGold, workforceRoster } from "./roster.js";

class AgentTheater {
  private tasks: AgentTaskRecord[] = [];
  /** Simple chain tracking (parent → child task ids) for future multi-step runs */
  private chains: Map<string, string[]> = new Map();

  async dispatch(
    memberId: string,
    prompt: string,
    skill: string,
    sessionId?: string,
    parentTaskId?: string,
  ): Promise<AgentTaskRecord> {
    const task: AgentTaskRecord = {
      id: `task_${Date.now()}`,
      memberId,
      codename:
        workforceRoster.getRoster().find((m) => m.id === memberId)?.codename ||
        memberId,
      skill,
      prompt,
      status: "queued",
      sessionId,
      parentTaskId,
      createdAt: new Date(),
    };

    this.tasks.unshift(task);

    if (parentTaskId) {
      const chain = this.chains.get(parentTaskId) ?? [];
      chain.push(task.id);
      this.chains.set(parentTaskId, chain);
    }

    console.log(`[GG Theater] Dispatched task to ${task.codename}: ${skill}`);

    // Auto-reward for dispatch (crown style)
    awardGold(memberId, 1, `theater dispatch: ${skill}`);

    return task;
  }

  async progressTasks(): Promise<void> {
    // Placeholder for real execution (hook to LLM/tools later)
    for (const task of this.tasks) {
      if (task.status === "queued") {
        task.status = "running";
        task.startedAt = new Date();
        // Simulate work
        setTimeout(() => {
          task.status = "completed";
          task.completedAt = new Date();
          task.durationMs = Date.now() - task.startedAt!.getTime();
        }, 100);
      }
    }
  }

  listTasks(limit = 50): AgentTaskRecord[] {
    return this.tasks.slice(0, limit);
  }

  getTask(taskId: string): AgentTaskRecord | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  status(): AgentTheaterStatusResponse {
    return {
      tasksQueued: this.tasks.filter((t) => t.status === "queued").length,
      tasksRunning: this.tasks.filter((t) => t.status === "running").length,
      tasksCompleted: this.tasks.filter((t) => t.status === "completed").length,
    };
  }
}

const theater = new AgentTheater();

export { theater as agentTheater, AgentTheater };
export type { AgentTaskRecord };
