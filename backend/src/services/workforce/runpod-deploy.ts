// runpod-deploy.ts — RunPod A5000 worker deploy for crown runpod-manager
// Stub-safe today; flip RUNPOD_LIVE=true next Weds when pod is hot.
// Action: auto-deploy-workers-on-retry
//
// Logging: [GG RunPod][level][reqId] message
// Live path: timeout + GraphQL error parsing + no secrets in logs

import {
  RUNPOD_A5000_CONFIG,
  type RunPodA5000Config,
} from "./crown-agents.js";

export type RunPodDeployMode = "stub" | "live";

export type RunPodDeployErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_POD_ID_WARN"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INVALID_JSON"
  | "GRAPHQL_ERROR"
  | "UNKNOWN";

export interface RunPodDeployOptions {
  /** Why we are deploying (retry, manual, phase, smoke) */
  reason?: string;
  /** Force live path even if retry-only policy would stub */
  forceLive?: boolean;
  /** Retry counter — auto-deploy fires when > 0 or reason contains "retry" */
  retryCount?: number;
  /** Fetch timeout ms for live API (default 20s) */
  timeoutMs?: number;
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
  /** Correlation id for log grepping */
  requestId: string;
  /** Wall time for this deploy attempt */
  durationMs: number;
  error?: string;
  errorCode?: RunPodDeployErrorCode;
  /** Redacted / safe upstream snippet (live only) */
  upstream?: unknown;
  deployedAt: string;
}

const LOG_PREFIX = "[GG RunPod]";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_API_URL = "https://api.runpod.io/graphql";

function newRequestId(): string {
  return `rp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type LogLevel = "info" | "warn" | "error" | "debug";

function log(
  level: LogLevel,
  requestId: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  const line = `${LOG_PREFIX}[${level}][${requestId}] ${message}`;
  const payload = extra && Object.keys(extra).length > 0 ? extra : undefined;
  if (level === "error") {
    console.error(line, payload ?? "");
  } else if (level === "warn") {
    console.warn(line, payload ?? "");
  } else {
    console.log(line, payload ?? "");
  }
}

function isLiveEnabled(): boolean {
  const flag = (process.env.RUNPOD_LIVE ?? "").toLowerCase().trim();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}

function hasApiKey(): boolean {
  return Boolean(process.env.RUNPOD_API_KEY?.trim());
}

function getPodId(): string | undefined {
  const id = process.env.RUNPOD_POD_ID?.trim();
  return id || undefined;
}

function getApiUrl(): string {
  const url = process.env.RUNPOD_API_URL?.trim();
  return url || DEFAULT_API_URL;
}

function isRetryTrigger(opts: RunPodDeployOptions): boolean {
  const reason = (opts.reason ?? "").toLowerCase();
  if ((opts.retryCount ?? 0) > 0) return true;
  if (reason.includes("retry")) return true;
  if (reason.includes("auto-deploy")) return true;
  return false;
}

function sanitizeReason(raw: string | undefined): string {
  const r = (raw ?? "manual").trim().slice(0, 200);
  // Strip control chars that break log lines
  return r.replace(/[\r\n\t]+/g, " ") || "manual";
}

/** Never log secrets — redact bearer-like strings in free text */
function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .replace(/rpa_[A-Za-z0-9_-]+/g, "rpa_***")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
}

function summarizeUpstream(body: unknown): unknown {
  if (body == null) return null;
  if (typeof body !== "object") return body;
  const o = body as Record<string, unknown>;
  // Prefer GraphQL errors / data shape without dumping full myself payload
  if (Array.isArray(o.errors) && o.errors.length > 0) {
    return {
      errors: o.errors.map((e) => {
        if (e && typeof e === "object" && "message" in e) {
          return { message: String((e as { message: unknown }).message) };
        }
        return e;
      }),
    };
  }
  if ("data" in o) {
    return { data: o.data };
  }
  return o;
}

function graphqlErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const msgs = errors
    .map((e) =>
      e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : null,
    )
    .filter(Boolean);
  return msgs.length ? msgs.join("; ") : "GraphQL error (no message)";
}

function fail(
  base: Omit<
    RunPodDeployResult,
    "ok" | "error" | "errorCode" | "durationMs" | "deployedAt"
  > & { start: number },
  error: string,
  errorCode: RunPodDeployErrorCode,
  upstream?: unknown,
): RunPodDeployResult {
  const safe = redactSecrets(error);
  base.steps.push(`errorCode=${errorCode}`);
  base.steps.push(`error=${safe}`);
  log("error", base.requestId, safe, {
    errorCode,
    mode: base.mode,
    reason: base.reason,
    autoRetry: base.autoRetry,
  });
  return {
    ok: false,
    mode: base.mode,
    action: base.action,
    reason: base.reason,
    pod: base.pod,
    steps: base.steps,
    autoRetry: base.autoRetry,
    requestId: base.requestId,
    durationMs: Date.now() - base.start,
    error: safe,
    errorCode,
    upstream: upstream !== undefined ? summarizeUpstream(upstream) : undefined,
    deployedAt: new Date().toISOString(),
  };
}

/**
 * Deploy / wake RunPod A5000 workers.
 * - Default: stub plan (safe, no network) — for prep until next Weds
 * - Live: requires RUNPOD_LIVE=true + RUNPOD_API_KEY (+ optional RUNPOD_POD_ID)
 */
export async function deployRunPodWorkers(
  opts: RunPodDeployOptions = {},
): Promise<RunPodDeployResult> {
  const start = Date.now();
  const requestId = newRequestId();
  const reason = sanitizeReason(opts.reason);
  const autoRetry = isRetryTrigger(opts);
  const pod = { ...RUNPOD_A5000_CONFIG };
  const steps: string[] = [];
  const timeoutMs =
    typeof opts.timeoutMs === "number" && opts.timeoutMs > 0
      ? opts.timeoutMs
      : DEFAULT_TIMEOUT_MS;

  const retryCount = opts.retryCount ?? 0;
  steps.push(`requestId=${requestId}`);
  steps.push(`action=${pod.action}`);
  steps.push(`gpu=${pod.gpu} volume=${pod.volume}`);
  steps.push(`ports=${pod.ports.join(",")} image=${pod.image}`);
  steps.push(`hybridLocal=${pod.hybridLocal}`);
  steps.push(
    `reason=${reason} autoRetry=${autoRetry} retryCount=${retryCount}`,
  );

  log("info", requestId, "deploy start", {
    reason,
    autoRetry,
    retryCount,
    forceLive: Boolean(opts.forceLive),
    liveEnv: isLiveEnabled(),
  });

  const wantLive = isLiveEnabled() || opts.forceLive === true;

  // ---- Stub path (default until Weds) ----
  if (!wantLive) {
    steps.push("mode=stub (set RUNPOD_LIVE=true next Weds for full power)");
    steps.push("would: ensure pod running + expose ports 8000/8002/8003");
    steps.push(`would: mount volume ${pod.volume} + pull torch image`);
    if (autoRetry) {
      steps.push("auto-deploy-workers-on-retry: stub logged (live on Weds)");
    }
    const durationMs = Date.now() - start;
    steps.push(`durationMs=${durationMs}`);
    log("info", requestId, "STUB deploy complete", {
      reason,
      volume: pod.volume,
      autoRetry,
      durationMs,
    });
    return {
      ok: true,
      mode: "stub",
      action: pod.action,
      reason,
      pod,
      steps,
      autoRetry,
      requestId,
      durationMs,
      deployedAt: new Date().toISOString(),
    };
  }

  // ---- Live path ----
  const base = {
    mode: "live" as const,
    action: pod.action,
    reason,
    pod,
    steps,
    autoRetry,
    requestId,
    start,
  };

  if (!hasApiKey()) {
    return fail(
      base,
      "RUNPOD_LIVE=true but RUNPOD_API_KEY missing — staying safe (no deploy)",
      "MISSING_API_KEY",
    );
  }

  const podId = getPodId();
  const apiKey = process.env.RUNPOD_API_KEY!.trim();
  const endpoint = getApiUrl();
  steps.push("mode=live");
  steps.push(`endpoint=${endpoint}`);
  steps.push(`timeoutMs=${timeoutMs}`);

  if (!podId) {
    steps.push(
      "warn=RUNPOD_POD_ID unset — will only handshake (myself), not resume A5000",
    );
    log("warn", requestId, "RUNPOD_POD_ID missing — handshake only", {
      errorCode: "MISSING_POD_ID_WARN",
    });
  }

  // Prefer variables over string interpolation (safer for GraphQL)
  const query = podId
    ? `mutation PodResume($podId: String!) {
        podResume(input: { podId: $podId }) { id desiredStatus lastStatusChange }
      }`
    : `{ myself { id email } }`;

  const variables = podId ? { podId } : undefined;

  steps.push(
    podId
      ? `upstream=podResume podId=${podId.slice(0, 6)}…`
      : "upstream=myself (set RUNPOD_POD_ID to resume A5000 pod)",
  );

  log("info", requestId, "LIVE request", {
    operation: podId ? "podResume" : "myself",
    hasPodId: Boolean(podId),
    timeoutMs,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("abort"));
      if (aborted) {
        return fail(
          base,
          `RunPod API timeout after ${timeoutMs}ms`,
          "TIMEOUT",
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      return fail(
        base,
        `RunPod network error: ${redactSecrets(msg)}`,
        "NETWORK_ERROR",
      );
    }

    steps.push(`http=${res.status}`);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return fail(
        base,
        `RunPod API returned non-JSON (HTTP ${res.status})`,
        "INVALID_JSON",
      );
    }

    if (!res.ok) {
      return fail(
        base,
        `RunPod API HTTP ${res.status}`,
        "HTTP_ERROR",
        body,
      );
    }

    const gqlErr = graphqlErrorMessage(body);
    if (gqlErr) {
      return fail(
        base,
        `RunPod GraphQL: ${redactSecrets(gqlErr)}`,
        "GRAPHQL_ERROR",
        body,
      );
    }

    steps.push("workers: auto-deploy-workers-on-retry path complete");
    const durationMs = Date.now() - start;
    steps.push(`durationMs=${durationMs}`);
    log("info", requestId, "LIVE deploy ok", {
      reason,
      volume: pod.volume,
      autoRetry,
      durationMs,
      operation: podId ? "podResume" : "myself",
    });

    return {
      ok: true,
      mode: "live",
      action: pod.action,
      reason,
      pod,
      steps,
      autoRetry,
      requestId,
      durationMs,
      upstream: summarizeUpstream(body),
      deployedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(base, `Unexpected error: ${redactSecrets(msg)}`, "UNKNOWN");
  } finally {
    clearTimeout(timer);
  }
}

/** Env readiness for Wednesday live cutover (key + live flag; pod id recommended). */
export function runPodLiveReady(): {
  live: boolean;
  hasKey: boolean;
  hasPodId: boolean;
  ready: boolean;
  /** ready + pod id — preferred for full resume */
  readyForResume: boolean;
  checklist: string[];
} {
  const live = isLiveEnabled();
  const hasKey = hasApiKey();
  const hasPodId = Boolean(getPodId());
  const ready = live && hasKey;
  const checklist: string[] = [];
  if (!live) checklist.push("Set RUNPOD_LIVE=true");
  if (!hasKey) checklist.push("Set RUNPOD_API_KEY");
  if (!hasPodId) checklist.push("Set RUNPOD_POD_ID (recommended for podResume)");
  if (ready && hasPodId) checklist.push("Ready for full A5000 resume");
  else if (ready) checklist.push("Ready for API handshake only (no POD_ID)");
  return {
    live,
    hasKey,
    hasPodId,
    ready,
    readyForResume: ready && hasPodId,
    checklist,
  };
}
