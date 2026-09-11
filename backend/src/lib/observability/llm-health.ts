/**
 * Brain-up/brain-down signal for ops.
 *
 * The chat path degrades softly when the LLM provider rejects a call, so a dead
 * provider is invisible from /health unless we record it here. Reasons are
 * coarse classifications — never raw provider text, which can carry account and
 * billing details we do not want on a public endpoint.
 *
 * Down/recovered transitions are also pushed to an alert sink (see
 * llm-alerts.ts) so the outage reaches a phone instead of waiting to be read
 * off /health.
 */

export type LlmFailureReason =
  | "credits_or_spending_limit"
  | "auth"
  | "rate_limited"
  | "timeout"
  | "refusal"
  | "empty_response"
  | "network"
  | "upstream_error";

export interface LlmHealthSnapshot {
  /** False once a call has failed and no later call has succeeded. */
  ok: boolean;
  configured: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: LlmFailureReason | null;
  lastFailureStatus: number | null;
  consecutiveFailures: number;
  totalFailures: number;
  /** Reason of the outage currently paged to ops; null when nothing is paged. */
  pagedReason: LlmFailureReason | null;
}

interface LlmErrorShape {
  status?: number;
  code?: string;
  message?: string;
}

/**
 * Brain-down / brain-back transition, emitted to the alert sink. Carries the
 * same coarse fields as the health snapshot — never provider text.
 */
export type LlmAlertEvent =
  | {
      kind: "down";
      reason: LlmFailureReason;
      status: number | null;
      consecutiveFailures: number;
      /** True when this repeats an earlier "down" for the same outage. */
      repeat: boolean;
    }
  | {
      kind: "recovered";
      /** Reason of the outage that just ended. */
      reason: LlmFailureReason;
      failuresDuringOutage: number;
      downForMs: number;
    };

export type LlmAlertSink = (event: LlmAlertEvent) => void;

/**
 * Deterministic failures (dead key, no credits) page on the first call; every
 * call after it will fail the same way. Transient classes wait for a streak so
 * one slow request at 3am does not wake anyone.
 */
export const LLM_ALERT_IMMEDIATE_REASONS: ReadonlySet<LlmFailureReason> = new Set([
  "credits_or_spending_limit",
  "auth",
]);
export const LLM_ALERT_STREAK_THRESHOLD = 3;
/** While the outage continues, re-page at most this often. */
export const LLM_ALERT_REPEAT_MS = 30 * 60 * 1000;

let configured = false;
let lastSuccessAt: string | null = null;
let lastFailureAt: string | null = null;
let lastFailureReason: LlmFailureReason | null = null;
let lastFailureStatus: number | null = null;
let consecutiveFailures = 0;
let totalFailures = 0;

let alertSink: LlmAlertSink | null = null;
/** Reason we last paged "down" for; null when no outage has been paged. */
let pagedReason: LlmFailureReason | null = null;
let pagedAtMs = 0;
let outageStartMs = 0;

/** Install where "down"/"recovered" transitions should go (ops alert channel). */
export function setLlmAlertSink(sink: LlmAlertSink | null): void {
  alertSink = sink;
}

function emit(event: LlmAlertEvent): void {
  if (!alertSink) return;
  try {
    alertSink(event);
  } catch {
    // The chat path must never fail because paging did.
  }
}

/** Called at boot so /health can distinguish "no key" from "key is failing". */
export function setLlmConfigured(value: boolean): void {
  configured = value;
}

export function classifyLlmFailure(error: LlmErrorShape): LlmFailureReason {
  const status = error.status;
  const code = error.code;
  const message = (error.message ?? "").toLowerCase();

  if (code === "timeout") return "timeout";
  if (code === "refusal") return "refusal";
  if (code === "empty_response") return "empty_response";
  if (code === "network") return "network";
  if (status === 429) return "rate_limited";
  if (
    status === 403 &&
    (message.includes("credit") ||
      message.includes("spending limit") ||
      message.includes("monthly"))
  ) {
    return "credits_or_spending_limit";
  }
  if (status === 401 || status === 403) return "auth";
  return "upstream_error";
}

export function recordLlmSuccess(now: number = Date.now()): void {
  lastSuccessAt = new Date(now).toISOString();
  const failuresDuringOutage = consecutiveFailures;
  consecutiveFailures = 0;

  if (pagedReason !== null) {
    emit({
      kind: "recovered",
      reason: pagedReason,
      failuresDuringOutage,
      downForMs: Math.max(0, now - outageStartMs),
    });
    pagedReason = null;
    pagedAtMs = 0;
  }
  outageStartMs = 0;
}

export function recordLlmFailure(error: LlmErrorShape, now: number = Date.now()): LlmFailureReason {
  const reason = classifyLlmFailure(error);
  lastFailureAt = new Date(now).toISOString();
  lastFailureReason = reason;
  lastFailureStatus = error.status ?? null;
  consecutiveFailures += 1;
  totalFailures += 1;
  if (consecutiveFailures === 1) outageStartMs = now;

  const meetsThreshold =
    LLM_ALERT_IMMEDIATE_REASONS.has(reason) || consecutiveFailures >= LLM_ALERT_STREAK_THRESHOLD;
  if (!meetsThreshold) return reason;

  const firstPage = pagedReason === null;
  const reasonChanged = pagedReason !== null && pagedReason !== reason;
  const stale = pagedReason !== null && now - pagedAtMs >= LLM_ALERT_REPEAT_MS;
  if (firstPage || reasonChanged || stale) {
    emit({
      kind: "down",
      reason,
      status: lastFailureStatus,
      consecutiveFailures,
      repeat: !firstPage && !reasonChanged,
    });
    pagedReason = reason;
    pagedAtMs = now;
  }
  return reason;
}

export function getLlmHealth(): LlmHealthSnapshot {
  return {
    ok: consecutiveFailures === 0,
    configured,
    lastSuccessAt,
    lastFailureAt,
    lastFailureReason,
    lastFailureStatus,
    consecutiveFailures,
    totalFailures,
    pagedReason,
  };
}

/** Test seam — reset module state between cases. */
export function resetLlmHealth(): void {
  configured = false;
  lastSuccessAt = null;
  lastFailureAt = null;
  lastFailureReason = null;
  lastFailureStatus = null;
  consecutiveFailures = 0;
  totalFailures = 0;
  alertSink = null;
  pagedReason = null;
  pagedAtMs = 0;
  outageStartMs = 0;
}
