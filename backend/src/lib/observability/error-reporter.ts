/**
 * Optional error reporting — no Sentry SDK required.
 *
 * Configure ERROR_WEBHOOK_URL (Slack/Discord/generic JSON POST) to receive
 * production errors. Always structured-logs locally.
 */

export type ReportedError = {
  message: string;
  name?: string;
  stack?: string;
  statusCode?: number;
  requestId?: string;
  path?: string;
  method?: string;
  extra?: Record<string, unknown>;
};

function webhookUrl(): string | null {
  return process.env.ERROR_WEBHOOK_URL?.trim() || null;
}

export function isErrorReportingConfigured(): boolean {
  return !!webhookUrl() || !!process.env.SENTRY_DSN?.trim();
}

/**
 * Fire-and-forget error report. Never throws.
 */
export async function reportError(
  err: ReportedError,
  log?: { error: (obj: unknown, msg?: string) => void },
): Promise<void> {
  const payload = {
    source: "procharacters-api",
    env: process.env.NODE_ENV ?? "unknown",
    ts: new Date().toISOString(),
    ...err,
    // Hint for ops dashboards — not a full Sentry client
    sentryDsnConfigured: !!process.env.SENTRY_DSN?.trim(),
  };

  log?.error(payload, "reported_error");

  const url = webhookUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[procharacters-api] ${err.statusCode ?? 500} ${err.method ?? ""} ${err.path ?? ""} — ${err.message}`,
        ...payload,
      }),
    });
  } catch (sendErr) {
    log?.error({ sendErr }, "error_webhook_failed");
  }
}
