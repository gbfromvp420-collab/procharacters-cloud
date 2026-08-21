import { describe, expect, it } from "vitest";
import { checkRateLimit, clientIp, enforceRateLimits } from "../src/lib/rate-limit.js";

// Unique keys per test so the in-process bucket map does not leak across cases.
let n = 0;
const key = (label: string) => `test:${label}:${n++}:${Math.random()}`;

describe("checkRateLimit", () => {
  it("allows hits up to the limit, then denies with a retry-after", () => {
    const k = key("basic");
    const limit = 3;
    const windowMs = 60_000;

    const r1 = checkRateLimit(k, limit, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    checkRateLimit(k, limit, windowMs);
    const r3 = checkRateLimit(k, limit, windowMs);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const denied = checkRateLimit(k, limit, windowMs);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(denied.limit).toBe(limit);
  });

  it("keeps separate windows per key", () => {
    const a = key("a");
    const b = key("b");
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false);
    // Different key is unaffected.
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true);
  });
});

describe("enforceRateLimits", () => {
  it("returns null when every check passes", () => {
    const result = enforceRateLimits([
      { key: key("ok1"), limit: 5, windowMs: 60_000 },
      { key: key("ok2"), limit: 5, windowMs: 60_000 },
    ]);
    expect(result).toBeNull();
  });

  it("returns the first denial", () => {
    const hot = key("hot");
    checkRateLimit(hot, 1, 60_000); // exhaust it
    const result = enforceRateLimits([
      { key: hot, limit: 1, windowMs: 60_000 },
      { key: key("cool"), limit: 5, windowMs: 60_000 },
    ]);
    expect(result).not.toBeNull();
    expect(result?.allowed).toBe(false);
  });
});

describe("clientIp", () => {
  it("uses the first entry of a string x-forwarded-for", () => {
    expect(clientIp({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })).toBe("1.2.3.4");
  });

  it("handles an array x-forwarded-for", () => {
    expect(clientIp({ "x-forwarded-for": ["9.9.9.9, 1.1.1.1"] })).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp({ "x-real-ip": "  8.8.8.8 " })).toBe("8.8.8.8");
  });

  it("returns 'unknown' when no proxy headers are present", () => {
    expect(clientIp({})).toBe("unknown");
    expect(clientIp({ "x-forwarded-for": "" })).toBe("unknown");
  });
});
