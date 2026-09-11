/**
 * Pages the ops channel when the brain goes down and again when it comes back.
 *
 * Bridges llm-health.ts (which decides *whether* a transition is worth paging)
 * to error-reporter.ts (which knows *where* — ntfy / Discord / Slack / email
 * via ERROR_WEBHOOK_URL and friends). Fire-and-forget: the chat turn that
 * observed the failure never waits on the webhook.
 *
 * Message text is built here from the coarse reason only. Provider error
 * bodies can carry account and billing detail and never reach this module.
 */

import { reportError } from "./error-reporter.js";
import { setLlmAlertSink, type LlmAlertEvent, type LlmFailureReason } from "./llm-health.js";

type Log = {
  error: (obj: unknown, msg?: string) => void;
  info?: (obj: unknown, msg?: string) => void;
};

/** What Gary should actually do when the page arrives. */
const ACTION_HINT: Record<LlmFailureReason, string> = {
  credits_or_spending_limit: "xAI credits exhausted or spending limit hit — top up / raise the limit in the xAI console.",
  auth: "xAI rejected the API key — check XAI_API_KEY on Railway and rotate if needed.",
  rate_limited: "xAI is rate-limiting us — check the usage tier or reduce concurrency.",
  timeout: "xAI calls are timing out — check status.x.ai and Railway egress.",
  network: "cannot reach xAI — check status.x.ai and Railway egress.",
  refusal: "xAI is refusing the prompts — check the model or a recent prompt change.",
  empty_response: "xAI is returning empty completions — check the model and max tokens.",
  upstream_error: "xAI is returning 5xx — check status.x.ai; usually clears on its own.",
};

function humanDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

export function buildLlmAlertMessage(event: LlmAlertEvent): string {
  if (event.kind === "down") {
    const head = event.repeat ? "BRAIN STILL DOWN" : "BRAIN DOWN";
    const status = event.status != null ? ` (HTTP ${event.status})` : "";
    const streak =
      event.consecutiveFailures === 1
        ? "first failed turn"
        : `${event.consecutiveFailures} failed turns in a row`;
    return `${head}: ${event.reason}${status}, ${streak}. Every character is replying with soft error copy. ${ACTION_HINT[event.reason]}`;
  }
  return `BRAIN BACK: chat is answering again after ${humanDuration(event.downForMs)} down (${event.reason}, ${event.failuresDuringOutage} failed turns).`;
}

/** Wire llm-health transitions into the ops alert channel. Call once at boot. */
export function installLlmAlerts(log?: Log): void {
  setLlmAlertSink((event) => {
    const message = buildLlmAlertMessage(event);
    const report =
      event.kind === "down"
        ? {
            message,
            name: event.repeat ? "LlmBrainStillDown" : "LlmBrainDown",
            statusCode: event.status ?? 502,
            path: "xai/chat",
            method: "LLM",
            extra: { reason: event.reason, consecutiveFailures: event.consecutiveFailures },
          }
        : {
            message,
            name: "LlmBrainRecovered",
            statusCode: 200,
            path: "xai/chat",
            method: "LLM",
            level: "info" as const,
            extra: {
              reason: event.reason,
              failuresDuringOutage: event.failuresDuringOutage,
              downForMs: event.downForMs,
            },
          };
    void reportError(report, log).catch(() => {
      // reportError never throws; belt and braces for the chat path.
    });
  });
}
