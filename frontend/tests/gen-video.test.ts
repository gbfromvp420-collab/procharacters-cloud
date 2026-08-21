import { describe, expect, it } from "vitest";
import {
  genVideoChipLabel,
  isGenVideoOptIn,
  isPlayableGenVideoUrl,
  overlayFromPerform,
} from "@/lib/gen-video";

describe("isGenVideoOptIn", () => {
  it("is only true for an explicit genVideo flag", () => {
    expect(isGenVideoOptIn({ genVideo: true })).toBe(true);
    expect(isGenVideoOptIn({ genVideo: false })).toBe(false);
    expect(isGenVideoOptIn({})).toBe(false);
    expect(isGenVideoOptIn(null)).toBe(false);
    expect(isGenVideoOptIn(undefined)).toBe(false);
  });
});

describe("isPlayableGenVideoUrl", () => {
  it("requires an http(s) url", () => {
    expect(isPlayableGenVideoUrl("https://cdn.example/v.mp4")).toBe(true);
    expect(isPlayableGenVideoUrl("http://x/v.mp4")).toBe(true);
    expect(isPlayableGenVideoUrl("/local/v.mp4")).toBe(false);
    expect(isPlayableGenVideoUrl("")).toBe(false);
    expect(isPlayableGenVideoUrl(null)).toBe(false);
  });
});

describe("genVideoChipLabel", () => {
  it("returns null when not opted in", () => {
    expect(genVideoChipLabel({ ...base, optedIn: false })).toBeNull();
  });

  it("maps status to a chip label when opted in", () => {
    expect(genVideoChipLabel({ ...base, status: "pending" })).toBe("Gen · …");
    expect(genVideoChipLabel({ ...base, status: "ready" })).toBe("Gen · live");
    expect(genVideoChipLabel({ ...base, status: "mock" })).toBe("Gen · mock");
    expect(genVideoChipLabel({ ...base, status: "off" })).toBe("Gen · off");
    expect(genVideoChipLabel({ ...base, status: "error" })).toBe("Gen · loops");
    expect(genVideoChipLabel({ ...base, status: "idle" })).toBe("Gen · on");
  });
});

const base = {
  optedIn: true,
  status: "idle" as const,
  provider: null,
  videoUrl: null,
  playable: false,
};

describe("overlayFromPerform", () => {
  it("reports off when the service is not configured", () => {
    const s = overlayFromPerform({ ok: true, configured: false });
    expect(s.status).toBe("off");
    expect(s.playable).toBe(false);
  });

  it("reports ready for a playable url", () => {
    const s = overlayFromPerform({
      ok: true,
      playable: true,
      videoUrl: "https://cdn/v.mp4",
      provider: "runpod",
    });
    expect(s.status).toBe("ready");
    expect(s.playable).toBe(true);
    expect(s.videoUrl).toBe("https://cdn/v.mp4");
  });

  it("reports mock for a non-playable url", () => {
    const s = overlayFromPerform({ ok: true, videoUrl: "data:mock" });
    expect(s.status).toBe("mock");
    expect(s.provider).toBe("mock");
  });

  it("reports error when nothing usable comes back", () => {
    const s = overlayFromPerform({ ok: false, error: "boom" });
    expect(s.status).toBe("error");
    expect(s.error).toBe("boom");
  });
});
