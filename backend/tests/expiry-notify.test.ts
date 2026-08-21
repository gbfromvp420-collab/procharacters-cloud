import { describe, expect, it } from "vitest";
import { dnaNodeLabel, isDnaPowerSession } from "../src/lib/push/expiry-notify.js";

describe("isDnaPowerSession", () => {
  it("is true for edge_pace sessions", () => {
    expect(
      isDnaPowerSession({ sessionMode: "edge_pace", dnaTreeNodeId: null, messageCount: 0 }),
    ).toBe(true);
  });

  it("is true when the DNA node id names a climb stage", () => {
    for (const node of ["edge-1", "deny", "release-2", "gate", "tease-a"]) {
      expect(
        isDnaPowerSession({ sessionMode: "normal", dnaTreeNodeId: node, messageCount: 0 }),
      ).toBe(true);
    }
  });

  it("is true for an engaged DNA forge with enough messages", () => {
    expect(
      isDnaPowerSession({ sessionMode: "normal", dnaTreeNodeId: "spark", messageCount: 4 }),
    ).toBe(true);
  });

  it("is false for a plain node with too few messages", () => {
    expect(
      isDnaPowerSession({ sessionMode: "normal", dnaTreeNodeId: "spark", messageCount: 2 }),
    ).toBe(false);
  });

  it("is false with no DNA and normal mode", () => {
    expect(
      isDnaPowerSession({ sessionMode: "normal", dnaTreeNodeId: null, messageCount: 10 }),
    ).toBe(false);
  });
});

describe("dnaNodeLabel", () => {
  it("maps known climb stages to friendly labels", () => {
    expect(dnaNodeLabel("release-1")).toBe("Release");
    expect(dnaNodeLabel("deny-hard")).toBe("Deny");
    expect(dnaNodeLabel("edger")).toBe("Edge");
    expect(dnaNodeLabel("tease")).toBe("Tease");
    expect(dnaNodeLabel("soft-lock")).toBe("Soft lock");
    expect(dnaNodeLabel("spark")).toBe("Spark");
  });

  it("returns the trimmed id for unknown nodes", () => {
    expect(dnaNodeLabel("  custom-node  ")).toBe("custom-node");
  });

  it("returns null for empty/undefined", () => {
    expect(dnaNodeLabel(undefined)).toBeNull();
    expect(dnaNodeLabel("")).toBeNull();
    expect(dnaNodeLabel("   ")).toBeNull();
  });
});
