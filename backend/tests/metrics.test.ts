import { describe, expect, it } from "vitest";
import {
  bump,
  getLastExpiryCron,
  getMetrics,
  recordExpiryCronTick,
} from "../src/lib/observability/metrics.js";

// The metrics module holds process-global counters, so assert on deltas rather
// than absolute values (tests may run in any order).

describe("getMetrics", () => {
  it("returns a snapshot with uptime and a startedAt", () => {
    const m = getMetrics();
    expect(typeof m.startedAt).toBe("string");
    expect(m.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(m).toHaveProperty("sessionsCreated");
    expect(m).toHaveProperty("lastExpiryCron");
  });

  it("returns a copy that does not mutate internal state", () => {
    const before = getMetrics().chatTurns;
    const snap = getMetrics();
    snap.chatTurns = 999_999;
    expect(getMetrics().chatTurns).toBe(before);
  });
});

describe("bump", () => {
  it("increments a counter by 1 by default", () => {
    const before = getMetrics().sessionsCreated;
    bump("sessionsCreated");
    expect(getMetrics().sessionsCreated).toBe(before + 1);
  });

  it("increments by an explicit amount", () => {
    const before = getMetrics().httpRequests;
    bump("httpRequests", 5);
    expect(getMetrics().httpRequests).toBe(before + 5);
  });
});

describe("recordExpiryCronTick", () => {
  it("bumps cron/sent/skipped counters and records the last tick", () => {
    const before = getMetrics();
    recordExpiryCronTick({ accounts: 2, sent: 3, skipped: 1 });
    const after = getMetrics();
    expect(after.pushExpiryCronTicks).toBe(before.pushExpiryCronTicks + 1);
    expect(after.pushExpirySent).toBe(before.pushExpirySent + 3);
    expect(after.pushExpirySkipped).toBe(before.pushExpirySkipped + 1);

    const last = getLastExpiryCron();
    expect(last).toMatchObject({ accounts: 2, sent: 3, skipped: 1 });
    expect(typeof last?.at).toBe("string");
  });

  it("only bumps the tick counter when nothing was sent or skipped", () => {
    const before = getMetrics();
    recordExpiryCronTick({ accounts: 0, sent: 0, skipped: 0 });
    const after = getMetrics();
    expect(after.pushExpiryCronTicks).toBe(before.pushExpiryCronTicks + 1);
    expect(after.pushExpirySent).toBe(before.pushExpirySent);
    expect(after.pushExpirySkipped).toBe(before.pushExpirySkipped);
    expect(getLastExpiryCron()).toMatchObject({ accounts: 0, sent: 0, skipped: 0 });
  });
});
