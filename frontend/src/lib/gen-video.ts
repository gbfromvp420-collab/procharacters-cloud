/** Opt-in generative video overlay. Default chat stays 4-loop clips. */

export type GenVideoOverlayState = {
  optedIn: boolean;
  status: "idle" | "pending" | "ready" | "mock" | "off" | "error";
  provider: string | null;
  videoUrl: string | null;
  playable: boolean;
  error?: string;
};

export const GEN_VIDEO_IDLE: GenVideoOverlayState = {
  optedIn: false,
  status: "idle",
  provider: null,
  videoUrl: null,
  playable: false,
};

export function isGenVideoOptIn(query: { genVideo?: boolean } | null | undefined): boolean {
  return query?.genVideo === true;
}

export function isPlayableGenVideoUrl(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

export function genVideoChipLabel(state: GenVideoOverlayState): string | null {
  if (!state.optedIn) return null;
  switch (state.status) {
    case "pending":
      return "Gen · …";
    case "ready":
      return "Gen · live";
    case "mock":
      return "Gen · mock";
    case "off":
      return "Gen · off";
    case "error":
      return "Gen · loops";
    default:
      return "Gen · on";
  }
}

export type GenVideoPerformResponse = {
  ok: boolean;
  configured?: boolean;
  provider?: string | null;
  videoUrl?: string | null;
  playable?: boolean;
  fallbackUsed?: boolean;
  error?: string;
};

export function overlayFromPerform(result: GenVideoPerformResponse): GenVideoOverlayState {
  if (result.configured === false) {
    return {
      optedIn: true,
      status: "off",
      provider: null,
      videoUrl: null,
      playable: false,
    };
  }
  if (result.playable && result.videoUrl) {
    return {
      optedIn: true,
      status: "ready",
      provider: result.provider ?? null,
      videoUrl: result.videoUrl,
      playable: true,
    };
  }
  if (result.ok && result.videoUrl) {
    return {
      optedIn: true,
      status: "mock",
      provider: result.provider ?? "mock",
      videoUrl: result.videoUrl,
      playable: false,
    };
  }
  return {
    optedIn: true,
    status: "error",
    provider: result.provider ?? null,
    videoUrl: null,
    playable: false,
    error: result.error,
  };
}
