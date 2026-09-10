/**
 * Brain-up/brain-down signal for ops.
 *
 * The chat path degrades softly when the LLM provider rejects a call, so a dead
 * provider is invisible from /health unless we record it here. Reasons are
 * coarse classifications — never raw provider text, which can carry account and
 * billing details we do not want on a public endpoint.
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
}

interface LlmErrorShape {
  status?: number;
  code?: string;
  message?: string;
}

let configured = false;
let lastSuccessAt: string | null = null;
let lastFailureAt: string | null = null;
let lastFailureReason: LlmFailureReason | null = null;
let lastFailureStatus: number | null = null;
let consecutiveFailures = 0;
let totalFailures = 0;

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

export function recordLlmSuccess(): void {
  lastSuccessAt = new Date().toISOString();
  consecutiveFailures = 0;
}

export function recordLlmFailure(error: LlmErrorShape): LlmFailureReason {
  const reason = classifyLlmFailure(error);
  lastFailureAt = new Date().toISOString();
  lastFailureReason = reason;
  lastFailureStatus = error.status ?? null;
  consecutiveFailures += 1;
  totalFailures += 1;
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
}
