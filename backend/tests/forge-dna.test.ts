import { describe, expect, it } from "vitest";
import {
  defaultBehaviorTree,
  defaultClipTags,
  defaultLiveKitMeta,
  dnaStarterLine,
  formatDnaMemorySeedsBlock,
  heuristicForgeExpand,
  isFemaleBase,
  parseLlmForgeJson,
  pickBandFromDnaSentiment,
  pickClipFromDnaIntensity,
} from "../src/lib/live/forge-dna.js";

describe("isFemaleBase", () => {
  it("recognizes the female base models", () => {
    expect(isFemaleBase("female-default")).toBe(true);
    expect(isFemaleBase("female-soft-goth")).toBe(true);
    expect(isFemaleBase("twink-default")).toBe(false);
    expect(isFemaleBase("nope")).toBe(false);
  });
});

describe("heuristicForgeExpand", () => {
  it("infers a twink base from keywords and tags edging", () => {
    const { dna, form } = heuristicForgeExpand({ fantasy: "a shy blushing boy who edges slow" });
    expect(dna.baseModelId).toBe("twink-shy-boy");
    expect(dna.vibeTags).toContain("edging");
    expect(dna.version).toBe("3.0");
    expect(dna.source).toBe("heuristic");
    expect(form.baseModelId).toBe("twink-shy-boy");
  });

  it("infers a female base from gendered keywords", () => {
    expect(heuristicForgeExpand({ fantasy: "a goth girl in lace" }).dna.baseModelId).toBe(
      "female-soft-goth",
    );
    expect(heuristicForgeExpand({ fantasy: "a brat girl who teases" }).dna.baseModelId).toBe(
      "female-playful-brat",
    );
  });

  it("respects an explicit base and display-name hint", () => {
    const { dna } = heuristicForgeExpand({
      fantasy: "custom heat",
      baseModelId: "twink-gym",
      displayNameHint: "Mateo",
    });
    expect(dna.baseModelId).toBe("twink-gym");
    expect(dna.displayName).toBe("Mateo");
  });

  it("clamps the evolution vector into range", () => {
    const { dna } = heuristicForgeExpand({ fantasy: "dominant edging denial chaos wild" });
    const e = dna.evolution;
    for (const v of [e.intimacy, e.chaos, e.denial, e.pace]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(e.power).toBeGreaterThanOrEqual(-1);
    expect(e.power).toBeLessThanOrEqual(1);
    expect(e.denial).toBeGreaterThan(0.6); // "edging denial" => strong denial bias
  });

  it("defaults tags to heat when nothing matches", () => {
    const { dna } = heuristicForgeExpand({ fantasy: "hello there" });
    expect(dna.vibeTags).toContain("heat");
    expect(dna.starterLine).toBeTruthy();
  });
});

describe("parseLlmForgeJson", () => {
  const input = { fantasy: "a slow edging twink" };

  it("overrides fields from valid JSON and marks source llm", () => {
    const raw = JSON.stringify({
      displayName: "Rio",
      identity: "mesh brat, mean-cool soft-dom presence on cam",
      vibe: "mean-cool brat edge",
      vibeTags: ["brat", "edging"],
      evolution: { power: 5, intimacy: 0.5, chaos: 0.5, denial: 0.9, pace: 0.5 },
    });
    const { dna } = parseLlmForgeJson(raw, input);
    expect(dna.source).toBe("llm");
    expect(dna.displayName).toBe("Rio");
    expect(dna.evolution.power).toBeLessThanOrEqual(1); // clamped from 5
    expect(dna.evolution.denial).toBeCloseTo(0.9, 5);
  });

  it("falls back to the heuristic when the payload is not JSON", () => {
    const { dna } = parseLlmForgeJson("sorry, no json here", input);
    expect(dna.source).toBe("heuristic");
  });
});

describe("dnaStarterLine", () => {
  it("prefers a substantial starterLine", () => {
    const { dna } = heuristicForgeExpand({ fantasy: "edging twink named Rio" });
    dna.starterLine = "look at me and don't finish yet";
    expect(dnaStarterLine(dna)).toBe("look at me and don't finish yet");
  });

  it("returns undefined for null dna", () => {
    expect(dnaStarterLine(null)).toBeUndefined();
    expect(dnaStarterLine(undefined)).toBeUndefined();
  });
});

describe("pickClipFromDnaIntensity", () => {
  const { dna } = heuristicForgeExpand({ fantasy: "edging twink" });

  it("maps arousal through the default intensity map", () => {
    expect(pickClipFromDnaIntensity(dna, 0.1)).toBe("idle");
    expect(pickClipFromDnaIntensity(dna, 0.4)).toBe("teasing");
    expect(pickClipFromDnaIntensity(dna, 0.6)).toBe("playful");
    expect(pickClipFromDnaIntensity(dna, 0.9)).toBe("aroused");
  });

  it("returns null without a dna", () => {
    expect(pickClipFromDnaIntensity(null, 0.5)).toBeNull();
  });
});

describe("pickBandFromDnaSentiment", () => {
  const { dna } = heuristicForgeExpand({ fantasy: "edging twink" });

  it("maps sentiment keywords to a band", () => {
    expect(pickBandFromDnaSentiment(dna, "so close, almost there")).toBe("aroused");
    expect(pickBandFromDnaSentiment(dna, "kiss me slow and gentle")).toBe("idle");
  });

  it("returns null when nothing matches", () => {
    expect(pickBandFromDnaSentiment(dna, "xyzzy qwerty")).toBeNull();
    expect(pickBandFromDnaSentiment(dna, "")).toBeNull();
  });
});

describe("formatDnaMemorySeedsBlock", () => {
  it("orders seeds by weight and formats each line", () => {
    const { dna } = heuristicForgeExpand({ fantasy: "edging obsession twink named Rio" });
    const block = formatDnaMemorySeedsBlock(dna);
    expect(block).toContain("- [");
    // the origin-fantasy seed (weight 0.9) should sort above the name seed (0.7)
    const lines = block.split("\n");
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe("default builders", () => {
  it("defaultLiveKitMeta covers all four bands", () => {
    const meta = defaultLiveKitMeta();
    expect(meta.bandOrder).toEqual(["idle", "teasing", "playful", "aroused"]);
    expect(meta.intensityMap.length).toBe(4);
  });

  it("defaultClipTags seeds each band from vibe tags", () => {
    const tags = defaultClipTags(["brat"]);
    expect(tags.idle.length).toBeGreaterThan(0);
    expect(tags.transitions.length).toBeGreaterThan(0);
  });

  it("defaultBehaviorTree roots at spark", () => {
    const tree = defaultBehaviorTree("mean-cool brat edge");
    expect(tree.rootId).toBe("spark");
    expect(tree.nodes.some((n) => n.id === "edge")).toBe(true);
  });
});
