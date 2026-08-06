/**
 * Optional error reporting — no Sentry SDK required.
 *
 * Channels (any one is enough):
 * - ERROR_WEBHOOK_URL → Discord / Slack / **ntfy.sh** (phone, no Discord needed)
 * - ERROR_ALERT_EMAIL + RESEND_API_KEY → email alert
 * - SENTRY_DSN → flag only (full Sentry SDK not bundled)
 *
 * Always structured-logs locally.
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

export type AlertChannel = "ntfy" | "discord" | "slack" | "generic" | "email" | "none";

function webhookUrl(): string | null {
  return process.env.ERROR_WEBHOOK_URL?.trim() || null;
}

function alertEmail(): string | null {
  const e = process.env.ERROR_ALERT_EMAIL?.trim();
  if (!e || !e.includes("@")) return null;
  return e;
}

function resendKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

export function isErrorWebhookUrlConfigured(): boolean {
  return !!webhookUrl();
}

export function isErrorEmailConfigured(): boolean {
  return !!alertEmail() && !!resendKey();
}

export function isErrorReportingConfigured(): boolean {
  return (
    isErrorWebhookUrlConfigured() ||
    isErrorEmailConfigured() ||
    !!process.env.SENTRY_DSN?.trim()
  );
}

/** Which channel health / pulse can label. */
export function primaryAlertChannel(): AlertChannel {
  const url = webhookUrl();
  if (url) return detectWebhookKind(url);
  if (isErrorEmailConfigured()) return "email";
  return "none";
}

function detectWebhookKind(url: string): AlertChannel {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "ntfy.sh" || host.endsWith(".ntfy.sh") || host === "ntfy") {
      return "ntfy";
    }
    if (host.includes("discord.com") || host.includes("discordapp.com")) {
      return "discord";
    }
    if (host.includes("hooks.slack.com") || host.includes("slack.com")) {
      return "slack";
    }
  } catch {
    /* generic */
  }
  return "generic";
}

function buildAlertLine(err: ReportedError): string {
  const code = err.statusCode ?? (err.test ? "TEST" : 500);
  const verb = err.method ?? "";
  const path = err.path ?? "";
  const prefix = err.test ? "TEST PING" : "ALERT";
  return `[procharacters-api] ${prefix} ${code} ${verb} ${path} — ${err.message}`
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; hint: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const hint = truncate(await res.text().catch(() => ""), 200);
  return { ok: res.ok, status: res.status, hint };
}

/** ntfy: free phone push — no Discord/Slack. POST plain text to topic URL. */
async function sendNtfy(
  url: string,
  err: ReportedError,
  line: string,
): Promise<{ ok: boolean; status: number; hint: string }> {
  const title = err.test
    ? "Procharacters · test OK"
    : `Procharacters · ${err.statusCode ?? 500}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Title: truncate(title, 120),
      Priority: err.test ? "default" : "high",
      Tags: err.test ? "white_check_mark,procharacters" : "rotating_light,procharacters",
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: truncate(
      [
        line,
        err.requestId ? `requestId: ${err.requestId}` : null,
        err.stack ? truncate(err.stack, 400) : null,
      ]
        .filter(Boolean)
        .join("\n"),
      3900,
    ),
  });
  const hint = truncate(await res.text().catch(() => ""), 200);
  return { ok: res.ok, status: res.status, hint };
}

async function sendDiscordOrSlack(
  url: string,
  err: ReportedError,
  line: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; hint: string }> {
  const body = {
    text: truncate(line, 3000),
    content: truncate(line, 1900),
    username: "procharacters-api",
    embeds: err.test
      ? [
          {
            title: "Error alert smoke — OK",
            description: "If you see this, ERROR_WEBHOOK_URL is live on procharacters-api.",
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
                  ? [
                      {
                        name: "path",
                        value: `${err.method ?? ""} ${err.path}`.trim(),
                        inline: true,
                      },
                    ]
                  : []),
                ...(payload.deploy
                  ? [{ name: "deploy", value: String(payload.deploy), inline: true }]
                  : []),
              ],
              timestamp: payload.ts,
            },
          ]
        : undefined,
    ...payload,
  };
  return postJson(url, body);
}

async function sendEmailAlert(
  err: ReportedError,
  line: string,
): Promise<{ ok: boolean; status?: number; hint?: string }> {
  const to = alertEmail();
  const key = resendKey();
  if (!to || !key) {
    return { ok: false, hint: "ERROR_ALERT_EMAIL or RESEND_API_KEY missing" };
  }
  const from =
    process.env.MAGIC_LINK_FROM?.trim() || "Procharacters <onboarding@resend.dev>";
  const subject = err.test
    ? "[Procharacters] Error alert test OK"
    : `[Procharacters] ${err.statusCode ?? 500} ${err.path ?? "error"}`;
  const text = [
    line,
    "",
    err.requestId ? `requestId: ${err.requestId}` : null,
    err.path ? `path: ${err.method ?? ""} ${err.path}` : null,
    err.stack ? `\n${truncate(err.stack, 1500)}` : null,
    "",
    "Free chat never depends on this — ops only.",
  ]
    .filter((x) => x != null)
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: truncate(subject, 200),
      text,
    }),
  });
  const hint = truncate(await res.text().catch(() => ""), 200);
  return { ok: res.ok, status: res.status, hint };
}

/**
 * Fire-and-forget error report. Never throws.
 */
export async function reportError(
  err: ReportedError,
  log?: {
    error: (obj: unknown, msg?: string) => void;
    info?: (obj: unknown, msg?: string) => void;
  },
): Promise<{ sent: boolean; configured: boolean; status?: number; error?: string; channel?: AlertChannel }> {
  const payload = {
    source: "procharacters-api",
    env: process.env.NODE_ENV ?? "unknown",
    ts: new Date().toISOString(),
    deploy:
      process.env.RAILWAY_GIT_COMMIT_SHA?.trim()?.slice(0, 7) ||
      process.env.GITHUB_SHA?.trim()?.slice(0, 7) ||
      null,
    ...err,
    stack: err.stack ? truncate(err.stack, 1200) : undefined,
    sentryDsnConfigured: !!process.env.SENTRY_DSN?.trim(),
  };

  if (err.test) {
    log?.info?.(payload, "reported_error_test");
  } else {
    log?.error(payload, "reported_error");
  }

  const line = buildAlertLine(err);
  const url = webhookUrl();
  const emailOn = isErrorEmailConfigured();

  if (!url && !emailOn) {
    return { sent: false, configured: false, channel: "none" };
  }

  let lastError: string | undefined;
  let lastStatus: number | undefined;
  let anySent = false;
  let channel: AlertChannel = "none";

  if (url) {
    channel = detectWebhookKind(url);
    try {
      const result =
        channel === "ntfy"
          ? await sendNtfy(url, err, line)
          : await sendDiscordOrSlack(url, err, line, payload);

      lastStatus = result.status;
      if (result.ok) {
        anySent = true;
      } else {
        lastError = `Webhook HTTP ${result.status}${result.hint ? `: ${result.hint}` : ""}`;
        log?.error({ status: result.status, hint: result.hint, channel }, "error_webhook_failed");
      }
    } catch (sendErr) {
      lastError = sendErr instanceof Error ? sendErr.message : "webhook fetch failed";
      log?.error({ sendErr, channel }, "error_webhook_failed");
    }
  }

  if (emailOn) {
    try {
      const result = await sendEmailAlert(err, line);
      if (result.ok) {
        anySent = true;
        if (channel === "none") channel = "email";
      } else {
        lastStatus = result.status;
        lastError =
          lastError ||
          `Email HTTP ${result.status ?? "?"}${result.hint ? `: ${result.hint}` : ""}`;
        log?.error({ ...result, channel: "email" }, "error_email_failed");
      }
    } catch (sendErr) {
      lastError =
        lastError ||
        (sendErr instanceof Error ? sendErr.message : "email send failed");
      log?.error({ sendErr }, "error_email_failed");
    }
  }

  return {
    sent: anySent,
    configured: true,
    status: lastStatus,
    error: anySent ? undefined : lastError,
    channel,
  };
}

/** Ops smoke — posts a test message to configured channel(s). */
export async function sendErrorWebhookTest(
  log?: {
    error: (obj: unknown, msg?: string) => void;
    info?: (obj: unknown, msg?: string) => void;
  },
): Promise<{
  sent: boolean;
  configured: boolean;
  status?: number;
  error?: string;
  channel?: AlertChannel;
}> {
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
