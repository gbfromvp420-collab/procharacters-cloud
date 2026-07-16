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
  startedAt: new Date().toISOString(),
};

export function bump(
  key: keyof Omit<MetricCounters, "startedAt">,
  by = 1,
): void {
  counters[key] += by;
}

export function getMetrics(): MetricCounters & { uptimeSec: number } {
  const started = Date.parse(counters.startedAt);
  const uptimeSec = Number.isFinite(started)
    ? Math.max(0, Math.floor((Date.now() - started) / 1000))
    : 0;
  return { ...counters, uptimeSec };
}
