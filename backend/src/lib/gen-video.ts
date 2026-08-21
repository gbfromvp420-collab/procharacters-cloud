/**
 * Opt-in generative video proxy → Python side service (`app/`).
 * Unset GEN_VIDEO_SERVICE_URL = loops only (live default).
 */

export function genVideoServiceUrl(): string | null {
  const raw = process.env.GEN_VIDEO_SERVICE_URL?.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw.replace(/\/$/, "");
}

export function isGenVideoConfigured(): boolean {
  return genVideoServiceUrl() !== null;
}

export type GenVideoPerformResult = {
  ok: boolean;
  configured: boolean;
  provider: string | null;
  videoUrl: string | null;
  jobId: string | null;
  durationMs: number | null;
  fallbackUsed: boolean;
  playable: boolean;
  error?: string;
};

const PLAYABLE = /^https?:\/\//i;

export function isPlayableGenVideoUrl(url: string | null | undefined): boolean {
  return !!url && PLAYABLE.test(url);
}

export async function proxyGenVideoPerform(input: {
  sessionId: string;
  characterId: string;
  message: string;
  signal?: AbortSignal;
}): Promise<GenVideoPerformResult> {
  const base = genVideoServiceUrl();
  if (!base) {
    return {
      ok: false,
      configured: false,
      provider: null,
      videoUrl: null,
      jobId: null,
      durationMs: null,
      fallbackUsed: false,
      playable: false,
      error: "Generative video service is not configured",
    };
  }

  const res = await fetch(`${base}/api/v1/video/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: input.sessionId,
      character_id: input.characterId,
      message: input.message,
    }),
    signal: input.signal,
  });

  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }

  if (!res.ok) {
    return {
      ok: false,
      configured: true,
      provider: typeof body.provider === "string" ? body.provider : null,
      videoUrl: null,
      jobId: null,
      durationMs: null,
      fallbackUsed: false,
      playable: false,
      error: typeof body.error === "string" ? body.error : `gen-video ${res.status}`,
    };
  }

  const videoUrl = typeof body.video_url === "string" ? body.video_url : null;
  return {
    ok: body.ok === true,
    configured: true,
    provider: typeof body.provider === "string" ? body.provider : null,
    videoUrl,
    jobId: typeof body.job_id === "string" ? body.job_id : null,
    durationMs: typeof body.duration_ms === "number" ? body.duration_ms : null,
    fallbackUsed: body.fallback_used === true,
    playable: isPlayableGenVideoUrl(videoUrl),
    error: typeof body.error === "string" ? body.error : undefined,
  };
}
