import { describe, expect, it } from "vitest";
import { calendarDaySeed, mindFingerprint, seededShuffle } from "@/lib/mind-fingerprint";

describe("mindFingerprint", () => {
  it("returns the catalog fingerprint for known ids", () => {
    const fp = mindFingerprint("liam");
    expect(fp?.tag).toBe("Spotlight");
    expect(fp?.blurb).toContain("Liam");
  });

  it("synthesizes a fingerprint for custom minds using hints", () => {
    const fp = mindFingerprint("custom-abc", {
      displayName: "Nova Star",
      energyLabel: "slow edge, denial",
    });
    expect(fp).not.toBeNull();
    expect(fp?.tag).toBe("Nova");
    expect(fp?.blurb).toContain("slow edge");
  });

  it("returns null for unknown non-custom ids and empty input", () => {
    expect(mindFingerprint("totally-unknown")).toBeNull();
    expect(mindFingerprint(null)).toBeNull();
    expect(mindFingerprint(undefined)).toBeNull();
  });
});

describe("calendarDaySeed", () => {
  it("encodes a UTC date as YYYYMMDD", () => {
    expect(calendarDaySeed(new Date("2026-08-21T12:00:00.000Z"))).toBe(20260821);
    expect(calendarDaySeed(new Date("2026-01-05T23:59:59.000Z"))).toBe(20260105);
  });
});

describe("seededShuffle", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("is deterministic for the same seed", () => {
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
  });

  it("differs across seeds and preserves the multiset", () => {
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    seededShuffle(items, 7);
    expect(items).toEqual(copy);
  });
});
