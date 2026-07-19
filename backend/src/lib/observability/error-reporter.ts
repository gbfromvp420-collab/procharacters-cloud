/**
 * Optional error reporting — no Sentry SDK required.
 *
 * Configure ERROR_WEBHOOK_URL (Slack / Discord / generic JSON POST) to receive
 * production 5xx alerts. Always structured-logs locally.
 *
 * Payload sends both `text` (Slack) and `content` (Discord) so one URL works.
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
  /** When true, marks a deliberate smoke ping (not a real 5xx). */
  test?: boolean;
};

function webhookUrl(): string | null {
  return process.env.ERROR_WEBHOOK_URL?.trim() || null;
}

export function isErrorReportingConfigured(): boolean {
  return !!webhookUrl() || !!process.env.SENTRY_DSN?.trim();
}

export function isErrorWebhookUrlConfigured(): boolean {
  return !!webhookUrl();
}

function buildAlertLine(err: ReportedError): string {
  const code = err.statusCode ?? (err.test ? "TEST" : 500);
  const verb = err.method ?? "";
  const path = err.path ?? "";
  const prefix = err.test ? "TEST PING" : "ALERT";
  return `[procharacters-api] ${prefix} ${code} ${verb} ${path} — ${err.message}`.replace(
    /\s+/g,
    " ",
  ).trim();
}

/** Discord content hard limit; keep headroom for formatting. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Fire-and-forget error report. Never throws.
 * @returns true if webhook POST was attempted and HTTP ok (or no webhook configured).
 */
export async function reportError(
  err: ReportedError,
  log?: { error: (obj: unknown, msg?: string) => void; info?: (obj: unknown, msg?: string) => void },
): Promise<{ sent: boolean; configured: boolean; status?: number; error?: string }> {
  const payload = {
    source: "procharacters-api",
    env: process.env.NODE_ENV ?? "unknown",
    ts: new Date().toISOString(),
    deploy:
      process.env.RAILWAY_GIT_COMMIT_SHA?.trim()?.slice(0, 7) ||
      process.env.GITHUB_SHA?.trim()?.slice(0, 7) ||
      null,
    ...err,
    // Drop huge stacks from wire payload (still in local log)
    stack: err.stack ? truncate(err.stack, 1200) : undefined,
    sentryDsnConfigured: !!process.env.SENTRY_DSN?.trim(),
  };

  if (err.test) {
    log?.info?.(payload, "reported_error_test");
  } else {
    log?.error(payload, "reported_error");
  }

  const url = webhookUrl();
  if (!url) {
    return { sent: false, configured: false };
  }

  const line = buildAlertLine(err);
  // Dual-format: Slack Incoming Webhooks use `text`; Discord uses `content`.
  const body = {
    text: truncate(line, 3000),
    content: truncate(line, 1900),
    username: "procharacters-api",
    // Discord-friendly embed for stack/context (ignored by Slack)
    embeds: err.test
      ? [
          {
            title: "Error webhook smoke — OK",
            description: truncate(
              "If you see this, ERROR_WEBHOOK_URL is live on procharacters-api.",
              500,
            ),
            color: 0x34d399,
            timestamp: payload.ts,
          },
        ]
      : err.stack || err.requestId
        ? [
            {
              title: truncate(`${err.name ?? "Error"} · ${err.statusCode ?? 500}`, 200),
              description: truncate(err.stack ?? err.message, 1500),
              color: 0xf43f5e,
              fields: [
                ...(err.requestId
                  ? [{ name: "requestId", value: err.requestId, inline: true }]
                  : []),
                ...(err.path
                  ? [{ name: "path", value: `${err.method ?? ""} ${err.path}`.trim(), inline: true }]
                  : []),
                ...(payload.deploy
                  ? [{ name: "deploy", value: payload.deploy, inline: true }]
                  : []),
              ],
              timestamp: payload.ts,
            },
          ]
        : undefined,
    // Full structured payload for generic receivers
    ...payload,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const hint = truncate(await res.text().catch(() => ""), 200);
      log?.error(
        { status: res.status, hint },
        "error_webhook_failed",
      );
      return {
        sent: false,
        configured: true,
        status: res.status,
        error: `Webhook HTTP ${res.status}${hint ? `: ${hint}` : ""}`,
      };
    }
    return { sent: true, configured: true, status: res.status };
  } catch (sendErr) {
    log?.error({ sendErr }, "error_webhook_failed");
    return {
      sent: false,
      configured: true,
      error: sendErr instanceof Error ? sendErr.message : "webhook fetch failed",
    };
  }
}

/** Ops smoke — posts a green test message to the configured webhook. */
export async function sendErrorWebhookTest(
  log?: { error: (obj: unknown, msg?: string) => void; info?: (obj: unknown, msg?: string) => void },
): Promise<{ sent: boolean; configured: boolean; status?: number; error?: string }> {
  return reportError(
    {
      message: "Manual smoke from Account System pulse / ops test endpoint",
      name: "ErrorWebhookTest",
      statusCode: 200,
      path: "/api/v1/ops/error-webhook/test",
      method: "POST",
      test: true,
    },
    log,
  );
}
