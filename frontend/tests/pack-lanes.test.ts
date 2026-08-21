import { describe, expect, it } from "vitest";
import {
  PACK_01_IDS,
  PACK_02_IDS,
  PACK_03_IDS,
  packLaneFor,
  packLaneLabel,
} from "@/lib/pack-lanes";

describe("packLaneFor", () => {
  it("classifies each pack's ids", () => {
    expect(packLaneFor("twink-default")).toBe("01");
    expect(packLaneFor("jenny")).toBe("02");
    expect(packLaneFor("liam")).toBe("03");
  });

  it("returns null for unknown ids", () => {
    expect(packLaneFor("not-a-real-id")).toBeNull();
    expect(packLaneFor("")).toBeNull();
  });

  it("assigns every catalog id to exactly one lane", () => {
    const all = [...PACK_01_IDS, ...PACK_02_IDS, ...PACK_03_IDS];
    expect(new Set(all).size).toBe(all.length); // no duplicates across packs
    for (const id of all) {
      expect(packLaneFor(id)).not.toBeNull();
    }
  });
});

describe("packLaneLabel", () => {
  it("labels known lanes and blanks null", () => {
    expect(packLaneLabel("01")).toBe("Pack 01");
    expect(packLaneLabel("02")).toBe("Pack 02");
    expect(packLaneLabel("03")).toBe("Pack 03");
    expect(packLaneLabel(null)).toBe("");
  });
});
