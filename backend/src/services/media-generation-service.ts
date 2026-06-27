/**
 * Media generation service — orchestrates image/video generation
 * using a pluggable provider architecture.
 *
 * Supports hot-swapping between RunwayML, Flux, SDXL, or our
 * private NSFW AI generation model family.
 */

import { v4 as uuid } from "uuid";
import type {
  GenerateImageResult,
  GenerateVideoResult,
  IMediaGenerationProvider,
  MediaGenerationRequest,
  MediaProvider,
  MediaProviderConfig,
  MediaStatus,
  MediaType,
} from "../types/media.js";
import type { AvatarState } from "../types/session.js";

/* ── Placeholder provider (dev / no-API fallback) ───────── */

class PlaceholderProvider implements IMediaGenerationProvider {
  readonly name: MediaProvider = "placeholder";

  async generateImage(request: MediaGenerationRequest): Promise<GenerateImageResult> {
    // Simulate generation delay
    await delay(500);
    return {
      url: `/avatar/${request.characterId}/generated-${Date.now()}.png`,
      width: 512,
      height: 768,
      seed: Math.floor(Math.random() * 999999),
    };
  }

  async generateVideo(request: MediaGenerationRequest): Promise<GenerateVideoResult> {
    await delay(1000);
    return {
      url: `/avatar/${request.characterId}/generated-${Date.now()}.mp4`,
      width: 512,
      height: 768,
      durationSeconds: 6,
      thumbnailUrl: `/avatar/${request.characterId}/thumb-${Date.now()}.jpg`,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

/* ── RunwayML-compatible provider ───────────────────────── */

/** Build an authorization header value from an API key. */
function bearerAuth(apiKey: string): string {
  return "Bearer " + apiKey;
}

class RunwayMLProvider implements IMediaGenerationProvider {
  readonly name: MediaProvider = "runwayml";

  constructor(private config: MediaProviderConfig) {}

  async generateImage(request: MediaGenerationRequest): Promise<GenerateImageResult> {
    if (!this.config.apiKey) throw new MediaGenerationError("RunwayML API key not configured");

    const fullPrompt = this.buildPrompt(request);

    try {
      const response = await fetch(`${this.config.baseUrl ?? "https://api.runwayml.com/v1"}/image/generate`, {
        method: "POST",
        headers: {
          "Authorization": bearerAuth(this.config.apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.modelId ?? "gen-3",
          prompt: fullPrompt,
          negative_prompt: request.negativePrompt ?? "cartoon, anime, deformed, blurry, low quality",
          width: this.config.width,
          height: this.config.height,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new MediaGenerationError(`RunwayML API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { url: string; seed?: number };
      return {
        url: data.url,
        width: this.config.width,
        height: this.config.height,
        seed: data.seed,
      };
    } catch (err) {
      if (err instanceof MediaGenerationError) throw err;
      throw new MediaGenerationError(`RunwayML generation failed: ${(err as Error).message}`);
    }
  }

  async generateVideo(request: MediaGenerationRequest): Promise<GenerateVideoResult> {
    if (!this.config.apiKey) throw new MediaGenerationError("RunwayML API key not configured");

    const fullPrompt = this.buildPrompt(request);

    try {
      const response = await fetch(`${this.config.baseUrl ?? "https://api.runwayml.com/v1"}/video/generate`, {
        method: "POST",
        headers: {
          "Authorization": bearerAuth(this.config.apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.modelId ?? "gen-3",
          prompt: fullPrompt,
          negative_prompt: request.negativePrompt ?? "cartoon, anime, deformed, blurry, low quality",
          width: this.config.width,
          height: this.config.height,
          duration: this.config.videoDurationSeconds ?? 6,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new MediaGenerationError(`RunwayML video API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { url: string; thumbnail_url?: string };
      return {
        url: data.url,
        width: this.config.width,
        height: this.config.height,
        durationSeconds: this.config.videoDurationSeconds ?? 6,
        thumbnailUrl: data.thumbnail_url,
      };
    } catch (err) {
      if (err instanceof MediaGenerationError) throw err;
      throw new MediaGenerationError(`RunwayML video generation failed: ${(err as Error).message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.config.baseUrl ?? "https://api.runwayml.com/v1"}/health`, {
        headers: { Authorization: bearerAuth(this.config.apiKey) },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildPrompt(request: MediaGenerationRequest): string {
    const appearance = Object.entries(request.appearanceRef)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    return [
      `Photorealistic, NSFW, adult content.`,
      `Character appearance: ${appearance}.`,
      `Current state: ${request.avatarState.emotion}, ${request.avatarState.pose}, ${request.avatarState.action}.`,
      `Arousal level: ${Math.round(request.avatarState.arousalLevel * 100)}%.`,
      `Clothing: ${request.avatarState.clothingState}.`,
      `Scene: ${request.prompt}`,
    ].join(" ");
  }
}

/* ── Internal NSFW model provider (our private model) ───── */

class InternalNSFWProvider implements IMediaGenerationProvider {
  readonly name: MediaProvider = "internal";

  constructor(private config: MediaProviderConfig) {}

  async generateImage(request: MediaGenerationRequest): Promise<GenerateImageResult> {
    if (!this.config.baseUrl) throw new MediaGenerationError("Internal NSFW model base URL not configured");

    const fullPrompt = this.buildNSFWPrompt(request);

    try {
      const response = await fetch(`${this.config.baseUrl}/generate/image`, {
        method: "POST",
        headers: {
          ...(this.config.apiKey ? { Authorization: bearerAuth(this.config.apiKey) } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          negative_prompt: request.negativePrompt ?? "cartoon, anime, 3d render, deformed",
          width: this.config.width,
          height: this.config.height,
          nsfw: true,
          character_ref: request.appearanceRef,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new MediaGenerationError(`Internal model API error: ${response.status}`);
      }

      const data = await response.json() as { url: string; seed?: number };
      return { url: data.url, width: this.config.width, height: this.config.height, seed: data.seed };
    } catch (err) {
      if (err instanceof MediaGenerationError) throw err;
      throw new MediaGenerationError(`Internal model generation failed: ${(err as Error).message}`);
    }
  }

  async generateVideo(request: MediaGenerationRequest): Promise<GenerateVideoResult> {
    if (!this.config.baseUrl) throw new MediaGenerationError("Internal NSFW model base URL not configured");

    const fullPrompt = this.buildNSFWPrompt(request);

    try {
      const response = await fetch(`${this.config.baseUrl}/generate/video`, {
        method: "POST",
        headers: {
          ...(this.config.apiKey ? { Authorization: bearerAuth(this.config.apiKey) } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          negative_prompt: request.negativePrompt,
          width: this.config.width,
          height: this.config.height,
          duration: this.config.videoDurationSeconds ?? 6,
          nsfw: true,
          character_ref: request.appearanceRef,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new MediaGenerationError(`Internal model video API error: ${response.status}`);
      }

      const data = await response.json() as { url: string; thumbnail_url?: string };
      return {
        url: data.url,
        width: this.config.width,
        height: this.config.height,
        durationSeconds: this.config.videoDurationSeconds ?? 6,
        thumbnailUrl: data.thumbnail_url,
      };
    } catch (err) {
      if (err instanceof MediaGenerationError) throw err;
      throw new MediaGenerationError(`Internal model video generation failed: ${(err as Error).message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.baseUrl) return false;
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildNSFWPrompt(request: MediaGenerationRequest): string {
    const appearance = Object.entries(request.appearanceRef)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    return [
      `Photorealistic adult NSFW content. 18+ only. Explicit.`,
      `Character: ${appearance}.`,
      `Expression: ${request.avatarState.emotion}. Pose: ${request.avatarState.pose}. Action: ${request.avatarState.action}.`,
      `Arousal: ${Math.round(request.avatarState.arousalLevel * 100)}%. Clothing: ${request.avatarState.clothingState}.`,
      request.prompt,
    ].join(" ");
  }
}

/* ── Media generation orchestrator ──────────────────────── */

export class MediaGenerationService {
  private provider: IMediaGenerationProvider;

  constructor(config: MediaProviderConfig) {
    this.provider = MediaGenerationService.createProvider(config);
  }

  static createProvider(config: MediaProviderConfig): IMediaGenerationProvider {
    switch (config.provider) {
      case "runwayml":
        return new RunwayMLProvider(config);
      case "internal":
        return new InternalNSFWProvider(config);
      case "placeholder":
      default:
        return new PlaceholderProvider();
    }
  }

  get providerName(): MediaProvider {
    return this.provider.name;
  }

  async generateImage(
    sessionId: string,
    characterId: string,
    prompt: string,
    appearanceRef: Record<string, string>,
    avatarState: AvatarState,
  ): Promise<GenerateImageResult> {
    const request = this.buildRequest(sessionId, characterId, "image", prompt, appearanceRef, avatarState);
    return this.provider.generateImage(request);
  }

  async generateVideo(
    sessionId: string,
    characterId: string,
    prompt: string,
    appearanceRef: Record<string, string>,
    avatarState: AvatarState,
  ): Promise<GenerateVideoResult> {
    const request = this.buildRequest(sessionId, characterId, "video", prompt, appearanceRef, avatarState);
    return this.provider.generateVideo(request);
  }

  async healthCheck(): Promise<{ provider: MediaProvider; healthy: boolean }> {
    const healthy = await this.provider.healthCheck();
    return { provider: this.provider.name, healthy };
  }

  private buildRequest(
    sessionId: string,
    characterId: string,
    type: MediaType,
    prompt: string,
    appearanceRef: Record<string, string>,
    avatarState: AvatarState,
  ): MediaGenerationRequest {
    return {
      id: uuid(),
      sessionId,
      characterId,
      type,
      prompt,
      appearanceRef,
      avatarState: {
        emotion: avatarState.emotion,
        pose: avatarState.pose,
        action: avatarState.action,
        arousalLevel: avatarState.arousalLevel,
        clothingState: avatarState.clothingState,
      },
      status: "queued" as MediaStatus,
      createdAt: new Date().toISOString(),
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MediaGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaGenerationError";
  }
}
