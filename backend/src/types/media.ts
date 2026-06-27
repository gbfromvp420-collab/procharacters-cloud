/**
 * Media generation pipeline types.
 *
 * Abstracts image and video generation behind a provider interface
 * so we can swap between any self-hosted NSFW-capable endpoint
 * (ComfyUI, A1111, Fooocus, custom API), Flux, SDXL, or our
 * own private NSFW model family.
 *
 * NOTE: RunwayML was removed — it blocks NSFW content.
 */

export type MediaType = "image" | "video";
export type MediaStatus = "queued" | "generating" | "ready" | "failed";

export interface MediaGenerationRequest {
  id: string;
  sessionId: string;
  characterId: string;
  type: MediaType;
  /** Natural-language prompt derived from chat context + avatar state. */
  prompt: string;
  /** Negative prompt for quality control. */
  negativePrompt?: string;
  /** Character appearance reference (from model.json). */
  appearanceRef: Record<string, string>;
  /** Current avatar state to keep continuity. */
  avatarState: {
    emotion: string;
    pose: string;
    action: string;
    arousalLevel: number;
    clothingState: string;
  };
  /** Provider-specific overrides (sampler, steps, cfg, LoRA, etc.). */
  providerOptions?: Record<string, unknown>;
  status: MediaStatus;
  resultUrl?: string;
  createdAt: string;
  completedAt?: string;
}

/* ── Provider abstraction ───────────────────────────────── */

/**
 * "generic" = any self-hosted NSFW endpoint (ComfyUI, A1111, Fooocus, etc.)
 * "internal" = our own private NSFW model service
 * "flux" / "sdxl" = specific model APIs with known schemas
 * "placeholder" = dev/offline fallback
 */
export type MediaProvider = "internal" | "generic" | "flux" | "sdxl" | "placeholder";

export interface MediaProviderConfig {
  provider: MediaProvider;
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
  /** Max concurrent generations. */
  concurrency: number;
  /** Default dimensions. */
  width: number;
  height: number;
  /** For video: duration in seconds. */
  videoDurationSeconds?: number;
  /** Sampler name for diffusion models (e.g. "euler_a", "dpmpp_2m"). */
  sampler?: string;
  /** Number of inference steps. */
  steps?: number;
  /** Classifier-free guidance scale. */
  cfgScale?: number;
}

export interface GenerateImageResult {
  url: string;
  width: number;
  height: number;
  seed?: number;
}

export interface GenerateVideoResult {
  url: string;
  width: number;
  height: number;
  durationSeconds: number;
  thumbnailUrl?: string;
}

/**
 * Minimal interface every media provider must implement.
 * Allows hot-swapping between any NSFW-capable generation backend.
 */
export interface IMediaGenerationProvider {
  readonly name: MediaProvider;
  generateImage(request: MediaGenerationRequest): Promise<GenerateImageResult>;
  generateVideo(request: MediaGenerationRequest): Promise<GenerateVideoResult>;
  healthCheck(): Promise<boolean>;
}
