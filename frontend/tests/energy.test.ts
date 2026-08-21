import { describe, expect, it } from "vitest";
import type { AvatarState } from "@/lib/types";
import {
  dnaNodeShortLabel,
  dnaTreeHeatLevel,
  energyBandFromAvatar,
  energyBandLabel,
} from "@/lib/energy";

const avatar = (over: Partial<AvatarState>): AvatarState =>
  ({ emotion: "", pose: "idle", action: "", arousalLevel: 0, ...over }) as AvatarState;

describe("energyBandFromAvatar", () => {
  it("returns idle for a null avatar", () => {
    expect(energyBandFromAvatar(null)).toBe("idle");
  });

  it("trusts an explicit energyBand", () => {
    expect(energyBandFromAvatar(avatar({ energyBand: "edge" }))).toBe("edge");
  });

  it("derives edge from emotion or high arousal", () => {
    expect(energyBandFromAvatar(avatar({ emotion: "edging" }))).toBe("edge");
    expect(energyBandFromAvatar(avatar({ emotion: "", arousalLevel: 0.8 }))).toBe("edge");
  });

  it("derives play, tease, and idle bands", () => {
    expect(energyBandFromAvatar(avatar({ emotion: "bratty smirk" }))).toBe("play");
    expect(energyBandFromAvatar(avatar({ emotion: "teasing" }))).toBe("tease");
    expect(energyBandFromAvatar(avatar({ emotion: "", arousalLevel: 0.4 }))).toBe("tease");
    expect(energyBandFromAvatar(avatar({ emotion: "calm", arousalLevel: 0.1 }))).toBe("idle");
  });
});

describe("energyBandLabel", () => {
  it("labels each band", () => {
    expect(energyBandLabel("edge")).toBe("Edge");
    expect(energyBandLabel("play")).toBe("Play");
    expect(energyBandLabel("tease")).toBe("Tease");
    expect(energyBandLabel("idle")).toBe("Idle");
  });
});

describe("dnaTreeHeatLevel", () => {
  it("maps node ids/labels to a 0-5 heat scale", () => {
    expect(dnaTreeHeatLevel("release-gate")).toBe(5);
    expect(dnaTreeHeatLevel("deny")).toBe(4);
    expect(dnaTreeHeatLevel("edge")).toBe(3);
    expect(dnaTreeHeatLevel("tease")).toBe(2);
    expect(dnaTreeHeatLevel("soft-lock")).toBe(1);
    expect(dnaTreeHeatLevel("spark")).toBe(0);
  });

  it("returns -1 when empty and 1 (soft) for unknown nodes", () => {
    expect(dnaTreeHeatLevel(null, null)).toBe(-1);
    expect(dnaTreeHeatLevel("mystery")).toBe(1);
  });
});

describe("dnaNodeShortLabel", () => {
  it("takes the first word of a label/id", () => {
    expect(dnaNodeShortLabel("edge", "Edge hold")).toBe("Edge");
    expect(dnaNodeShortLabel("release-gate", null)).toBe("release-gate");
    expect(dnaNodeShortLabel(null, null)).toBeNull();
  });
});
