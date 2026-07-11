// runpod-deploy.ts — RunPod A5000 worker deploy for crown runpod-manager
// Stub-safe today; flip RUNPOD_LIVE=true next Weds when pod is hot.
// Action: auto-deploy-workers-on-retry

import {
  RUNPOD_A5000_CONFIG,
  type RunPodA5000Config,
} from "./crown-agents.js";

export type RunPodDeployMode = "stub" | "live";

export interface RunPodDeployOptions {
  /** Why we are deploying (retry, manual, phase, smoke) */
  reason?: string;
  /** Force live path even if retry-only policy would stub */
  forceLive?: boolean;
  /** Retry counter — auto-deploy fires when > 0 or reason contains "retry" */
  retryCount?: number;
}

export interface RunPodDeployResult {
  ok: boolean;
  mode: RunPodDeployMode;
  action: typeof RUNPOD_A5000_CONFIG.action;
  reason: string;
  pod: RunPodA5000Config;
  steps: string[];
  /** True when this call was an auto-deploy-on-retry path */
  autoRetry: boolean;
  error?: string;
  /** Raw upstream response snippet (live only) */
  upstream?: unknown;
  deployedAt: string;
}

function isLiveEnabled(): boolean {
  const flag = (process.env.RUNPOD_LIVE ?? "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function hasApiKey(): boolean {
  return Boolean(process.env.RUNPOD_API_KEY?.trim());
}

function isRetryTrigger(opts: RunPodDeployOptions): boolean {
  const reason = (opts.reason ?? "").toLowerCase();
  if ((opts.retryCount ?? 0) > 0) return true;
  if (reason.includes("retry")) return true;
  if (reason.includes("auto-deploy")) return true;
  return false;
}

/**
 * Deploy / wake RunPod A5000 workers.
 * - Default: stub plan (safe, no network) — for prep until next Weds
 * - Live: requires RUNPOD_LIVE=true + RUNPOD_API_KEY (+ optional RUNPOD_POD_ID)
 */
export async function deployRunPodWorkers(
  opts: RunPodDeployOptions = {},
): Promise<RunPodDeployResult> {
  const reason = opts.reason ?? "manual";
  const autoRetry = isRetryTrigger(opts);
  const pod = { ...RUNPOD_A5000_CONFIG };
  const steps: string[] = [];
  const deployedAt = new Date().toISOString();

  steps.push(`action=${pod.action}`);
  steps.push(`gpu=${pod.gpu} volume=${pod.volume}`);
  steps.push(`ports=${pod.ports.join(",")} image=${pod.image}`);
  steps.push(`hybridLocal=${pod.hybridLocal}`);
  steps.push(`reason=${reason} autoRetry=${autoRetry}`);

  const wantLive = isLiveEnabled() || opts.forceLive === true;

  if (!wantLive) {
    steps.push("mode=stub (set RUNPOD_LIVE=true next Weds for full power)");
    steps.push("would: ensure pod running + expose ports 8000/8002/8003");
    steps.push("would: mount volume mmf8n0smfo + pull torch image");
    if (autoRetry) {
      steps.push("auto-deploy-workers-on-retry: stub logged (live on Weds)");
    }
    console.log(
      `[GG RunPod] STUB deploy — ${reason} · A5000 · vol ${pod.volume} · retry=${autoRetry}`,
    );
    return {
      ok: true,
      mode: "stub",
      action: pod.action,
      reason,
      pod,
      steps,
      autoRetry,
      deployedAt,
    };
  }

  if (!hasApiKey()) {
    const error =
      "RUNPOD_LIVE=true but RUNPOD_API_KEY missing — staying safe (no deploy)";
    steps.push(`error=${error}`);
    console.error(`[GG RunPod] ${error}`);
    return {
      ok: false,
      mode: "live",
      action: pod.action,
      reason,
      pod,
      steps,
      autoRetry,
      error,
      deployedAt,
    };
  }

  steps.push("mode=live");
  const podId = process.env.RUNPOD_POD_ID?.trim();
  const apiKey = process.env.RUNPOD_API_KEY!.trim();
  const endpoint =
    process.env.RUNPOD_API_URL?.trim() || "https://api.runpod.io/graphql";

  // Minimal GraphQL: resume/start pod if id present; else status-only handshake
  const query = podId
    ? `mutation { podResume(input: { podId: "${podId}" }) { id desiredStatus } }`
    : `{ myself { id } }`;

  steps.push(
    podId
      ? `upstream=podResume podId=${podId}`
      : "upstream=myself (set RUNPOD_POD_ID to resume A5000 pod)",
  );

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query }),
    });
    const body = (await res.json().catch(() => ({}))) as unknown;
    steps.push(`http=${res.status}`);

    if (!res.ok) {
      const error = `RunPod API HTTP ${res.status}`;
      console.error(`[GG RunPod] LIVE fail: ${error}`);
      return {
        ok: false,
        mode: "live",
        action: pod.action,
        reason,
        pod,
        steps,
        autoRetry,
        error,
        upstream: body,
        deployedAt,
      };
    }

    console.log(
      `[GG RunPod] LIVE deploy ok — ${reason} · A5000 · vol ${pod.volume} · retry=${autoRetry}`,
    );
    steps.push("workers: auto-deploy-workers-on-retry path complete");
    return {
      ok: true,
      mode: "live",
      action: pod.action,
      reason,
      pod,
      steps,
      autoRetry,
      upstream: body,
      deployedAt,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    steps.push(`error=${error}`);
    console.error(`[GG RunPod] LIVE exception: ${error}`);
    return {
      ok: false,
      mode: "live",
      action: pod.action,
      reason,
      pod,
      steps,
      autoRetry,
      error,
      deployedAt,
    };
  }
}

/** True when env is ready for Wednesday live deploy (key + live flag). */
export function runPodLiveReady(): {
  live: boolean;
  hasKey: boolean;
  hasPodId: boolean;
  ready: boolean;
} {
  const live = isLiveEnabled();
  const hasKey = hasApiKey();
  const hasPodId = Boolean(process.env.RUNPOD_POD_ID?.trim());
  return {
    live,
    hasKey,
    hasPodId,
    ready: live && hasKey,
  };
}
