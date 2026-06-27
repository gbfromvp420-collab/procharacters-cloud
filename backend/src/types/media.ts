/**
 * Media generation pipeline types.
 *
 * Abstracts image and video generation behind a provider interface
 * so we can swap between RunwayML-style APIs, Flux, SDXL, or our
 * own private NSFW model family.
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
  /** Provider-specific overrides. */
  providerOptions?: Record<string, unknown>;
  status: MediaStatus;
  resultUrl?: string;
  createdAt: string;
  completedAt?: string;
}

/* ── Provider abstraction ───────────────────────────────── */

export type MediaProvider = "internal" | "runwayml" | "flux" | "sdxl" | "placeholder";

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
 * Allows hot-swapping between RunwayML, our private NSFW model, etc.
 */
export interface IMediaGenerationProvider {
  readonly name: MediaProvider;
  generateImage(request: MediaGenerationRequest): Promise<GenerateImageResult>;
  generateVideo(request: MediaGenerationRequest): Promise<GenerateVideoResult>;
  healthCheck(): Promise<boolean>;
}
