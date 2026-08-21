import { describe, expect, it } from "vitest";
import { absoluteMediaUrl, isSmokeTestCard } from "@/lib/character-card";

describe("isSmokeTestCard", () => {
  it("flags leftover Railway smoke cards", () => {
    expect(isSmokeTestCard({ id: "prodbatch-1", displayName: "x" })).toBe(true);
    expect(isSmokeTestCard({ id: "x", displayName: "VolumeCheck A" })).toBe(true);
    expect(isSmokeTestCard({ id: "produpload", displayName: "y" })).toBe(true);
  });

  it("keeps real cards", () => {
    expect(isSmokeTestCard({ id: "liam", displayName: "Liam" })).toBe(false);
    expect(isSmokeTestCard({ id: "twink-default", displayName: "Twink Default" })).toBe(false);
  });
});

describe("absoluteMediaUrl", () => {
  it("passes through absolute urls", () => {
    expect(absoluteMediaUrl("https://cdn/x.mp4", "https://site")).toBe("https://cdn/x.mp4");
  });

  it("joins root-relative paths to the origin", () => {
    expect(absoluteMediaUrl("/avatar/liam/idle.mp4", "https://site")).toBe(
      "https://site/avatar/liam/idle.mp4",
    );
  });

  it("joins bare paths and strips a trailing slash on the origin", () => {
    expect(absoluteMediaUrl("avatar/liam/idle.mp4", "https://site/")).toBe(
      "https://site/avatar/liam/idle.mp4",
    );
  });
});
