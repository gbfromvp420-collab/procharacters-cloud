import { describe, expect, it } from "vitest";
import { presenceMotionClass, presenceVisual, resolvePresenceSkin } from "@/lib/presence";

describe("resolvePresenceSkin", () => {
  it("trusts a valid server presenceSkin", () => {
    expect(resolvePresenceSkin("female_goth", "anything")).toBe("female_goth");
  });

  it("maps known character ids to skins", () => {
    expect(resolvePresenceSkin(null, "twink-gym")).toBe("twink_gym");
    expect(resolvePresenceSkin(null, "female-playful-brat")).toBe("female_brat");
  });

  it("falls back for custom, female-ish, and unknown ids", () => {
    expect(resolvePresenceSkin(null, "custom-xyz")).toBe("custom");
    expect(resolvePresenceSkin(null, "some-female-thing")).toBe("female_default");
    expect(resolvePresenceSkin(null, "who-knows")).toBe("twink_default");
    expect(resolvePresenceSkin(null, null)).toBe("twink_default");
  });
});

describe("presenceVisual", () => {
  it("returns the visual for a known skin", () => {
    const v = presenceVisual("female_goth");
    expect(v.label).toBe("Soft goth");
    expect(v.filter).toBeTruthy();
  });

  it("falls back to the default visual for unknown skins", () => {
    const v = presenceVisual("nonexistent-skin");
    expect(v).toEqual(presenceVisual("twink_default"));
  });
});

describe("presenceMotionClass", () => {
  it("scales up with heat", () => {
    expect(presenceMotionClass("edge")).toContain("1.03");
    expect(presenceMotionClass("play")).toContain("1.02");
    expect(presenceMotionClass("tease")).toContain("1.01");
    expect(presenceMotionClass("idle")).toContain("scale-100");
  });
});
