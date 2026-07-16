/**
 * Lightweight in-process metrics for ops (no Prometheus required).
 * Resets on process restart — fine for Railway single-instance.
 */

export type MetricCounters = {
  httpRequests: number;
  httpErrors4xx: number;
  httpErrors5xx: number;
  wsConnections: number;
  wsErrors: number;
  sessionsCreated: number;
  chatTurns: number;
  chatLlmErrors: number;
  customCharactersCreated: number;
  authRegister: number;
  authLogin: number;
  authFailures: number;
  pushTestSent: number;
  pushSubscribe: number;
  pushExpirySent: number;
  pushExpirySkipped: number;
  pushExpiryCronTicks: number;
  startedAt: string;
};

const counters: MetricCounters = {
  httpRequests: 0,
  httpErrors4xx: 0,
  httpErrors5xx: 0,
  wsConnections: 0,
  wsErrors: 0,
  sessionsCreated: 0,
  chatTurns: 0,
  chatLlmErrors: 0,
  customCharactersCreated: 0,
  authRegister: 0,
  authLogin: 0,
  authFailures: 0,
  pushTestSent: 0,
  pushSubscribe: 0,
  pushExpirySent: 0,
  pushExpirySkipped: 0,
  pushExpiryCronTicks: 0,
  startedAt: new Date().toISOString(),
};

/** Last successful expiry-cron tick summary (in-memory). */
let lastExpiryCron: {
  at: string;
  accounts: number;
  sent: number;
  skipped: number;
} | null = null;

export function bump(
  key: keyof Omit<MetricCounters, "startedAt">,
  by = 1,
): void {
  counters[key] += by;
}

export function recordExpiryCronTick(summary: {
  accounts: number;
  sent: number;
  skipped: number;
}): void {
  bump("pushExpiryCronTicks");
  if (summary.sent > 0) bump("pushExpirySent", summary.sent);
  if (summary.skipped > 0) bump("pushExpirySkipped", summary.skipped);
  lastExpiryCron = {
    at: new Date().toISOString(),
    accounts: summary.accounts,
    sent: summary.sent,
    skipped: summary.skipped,
  };
}

export function getLastExpiryCron(): typeof lastExpiryCron {
  return lastExpiryCron;
}

export function getMetrics(): MetricCounters & {
  uptimeSec: number;
  lastExpiryCron: typeof lastExpiryCron;
} {
  const started = Date.parse(counters.startedAt);
  const uptimeSec = Number.isFinite(started)
    ? Math.max(0, Math.floor((Date.now() - started) / 1000))
    : 0;
  return { ...counters, uptimeSec, lastExpiryCron };
}
