import { describe, expect, it } from "vitest";
import {
  computeModeState,
  formatModeForUi,
  normalizeSessionMode,
} from "../src/lib/live/session-mode.js";

const START = "2026-01-01T00:00:00.000Z";
const startMs = Date.parse(START);
const at = (sec: number) => startMs + sec * 1000;

describe("normalizeSessionMode", () => {
  it("maps edge_pace through and everything else to normal", () => {
    expect(normalizeSessionMode("edge_pace")).toBe("edge_pace");
    expect(normalizeSessionMode("normal")).toBe("normal");
    expect(normalizeSessionMode(undefined)).toBe("normal");
    expect(normalizeSessionMode(null)).toBe("normal");
    expect(normalizeSessionMode("bogus")).toBe("normal");
  });
});

describe("computeModeState (normal)", () => {
  it("returns a static normal state regardless of time", () => {
    const s = computeModeState("normal", START, at(9999));
    expect(s.mode).toBe("normal");
    expect(s.phase).toBe("build");
    expect(s.round).toBe(0);
    expect(s.phaseRemainingSec).toBe(0);
    expect(s.coachCue).toBeTruthy();
  });
});

describe("computeModeState (edge_pace phase math)", () => {
  it("starts in build with a full window", () => {
    const s = computeModeState("edge_pace", START, at(0));
    expect(s.phase).toBe("build");
    expect(s.round).toBe(0);
    expect(s.phaseElapsedSec).toBe(0);
    expect(s.phaseRemainingSec).toBe(70);
    expect(s.label).toContain("R1");
  });

  it("advances through hold, almost, breathe within the first round", () => {
    expect(computeModeState("edge_pace", START, at(70)).phase).toBe("hold");
    expect(computeModeState("edge_pace", START, at(120)).phase).toBe("almost");
    expect(computeModeState("edge_pace", START, at(155)).phase).toBe("breathe");
  });

  it("computes remaining seconds inside a phase", () => {
    const hold = computeModeState("edge_pace", START, at(90)); // 20s into hold(50)
    expect(hold.phase).toBe("hold");
    expect(hold.phaseElapsedSec).toBe(20);
    expect(hold.phaseRemainingSec).toBe(30);
  });

  it("rolls into the next round after ROUND_SEC (180s)", () => {
    const r2 = computeModeState("edge_pace", START, at(180));
    expect(r2.round).toBe(1);
    expect(r2.phase).toBe("build");
    expect(r2.label).toContain("R2");
  });

  it("treats an unparseable start time as t=0", () => {
    const s = computeModeState("edge_pace", "not-a-date", at(999));
    expect(s.round).toBe(0);
    expect(s.phase).toBe("build");
  });
});

describe("formatModeForUi", () => {
  it("derives phaseDurationSec and ships edge chips/fire in edge_pace", () => {
    const state = computeModeState("edge_pace", START, at(0));
    const ui = formatModeForUi(state, "twink-default");
    expect(ui.mode).toBe("edge_pace");
    expect(ui.phaseDurationSec).toBe(70);
    expect(ui.fireLine).toBeTruthy();
    expect(Array.isArray(ui.phaseChips)).toBe(true);
    expect(ui.phaseChips.length).toBeGreaterThan(0);
    expect(ui.dnaTreeNodeId).toBeUndefined();
  });

  it("exposes DNA tree fields and lets DNA own fire in normal mode", () => {
    const state = computeModeState("normal", START, at(0));
    const ui = formatModeForUi(state, "twink-default", {
      nodeId: "release-1",
      label: "Release",
      fireLine: "custom dna fire",
      chips: ["a", "b"],
      advanced: true,
    });
    expect(ui.dnaTreeNodeId).toBe("release-1");
    expect(ui.dnaTreeLabel).toBe("Release");
    expect(ui.dnaTreeAdvanced).toBe(true);
    expect(ui.fireLine).toBe("custom dna fire");
  });
});
