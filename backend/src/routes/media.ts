/**
 * Media generation API routes.
 */

import type { FastifyInstance } from "fastify";
import type { MediaGenerationService } from "../services/media-generation-service.js";
import type { TokenService } from "../services/token-service.js";
import { mediaGenerateBodySchema } from "./schemas.js";

export function createMediaRoutes(
  mediaGen: MediaGenerationService,
  tokenService: TokenService,
) {
  return async function mediaRoutes(app: FastifyInstance) {
    /** Health check for the media generation provider. */
    app.get("/media/health", async () => {
      return mediaGen.healthCheck();
    });

    /** Generate an NSFW image for a session. */
    app.post<{
      Body: {
        sessionId: string;
        userId: string;
        characterId: string;
        prompt: string;
        appearanceRef: Record<string, string>;
        avatarState: {
          emotion: string;
          pose: string;
          action: string;
          arousalLevel: number;
          clothingState: string;
        };
      };
    }>("/media/generate/image", async (request, reply) => {
      const parsed = mediaGenerateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
      }
      const { sessionId, userId, characterId, prompt, appearanceRef, avatarState } = parsed.data;

//      // Debit tokens for image generation
//      try {
//        const cost = tokenService.getCostForAction("imageGeneration");
//        tokenService.debit(userId, cost, "media_generation", {
//          sessionId,
//          type: "image",
//        });
//      } catch (err) {
//        const msg = err instanceof Error ? err.message : "Token debit failed";
//        return reply.status(402).send({ error: msg });
//      }

      try {
        const result = await mediaGen.generateImage(
          sessionId,
          characterId,
          prompt,
          appearanceRef,
          { ...avatarState, mediaUrl: undefined },
        );
        return { image: result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Image generation failed";
        // Refund on failure
        const cost = tokenService.getCostForAction("imageGeneration");
        tokenService.credit(userId, cost, "refund", { sessionId, reason: "generation_failed" });
        return reply.status(500).send({ error: msg });
      }
    });

    /** Generate an NSFW video clip for a session. */
    app.post<{
      Body: {
        sessionId: string;
        userId: string;
        characterId: string;
        prompt: string;
        appearanceRef: Record<string, string>;
        avatarState: {
          emotion: string;
          pose: string;
          action: string;
          arousalLevel: number;
          clothingState: string;
        };
      };
    }>("/media/generate/video", async (request, reply) => {
      const parsed = mediaGenerateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
      }
      const { sessionId, userId, characterId, prompt, appearanceRef, avatarState } = parsed.data;

//      // Debit tokens for video generation
//      try {
//        const cost = tokenService.getCostForAction("videoGeneration");
//        tokenService.debit(userId, cost, "media_generation", {
//          sessionId,
//          type: "video",
//        });
//      } catch (err) {
//        const msg = err instanceof Error ? err.message : "Token debit failed";
//        return reply.status(402).send({ error: msg });
//      }

      try {
        const result = await mediaGen.generateVideo(
          sessionId,
          characterId,
          prompt,
          appearanceRef,
          { ...avatarState, mediaUrl: undefined },
        );
        return { video: result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Video generation failed";
        // Refund on failure
        const cost = tokenService.getCostForAction("videoGeneration");
        tokenService.credit(userId, cost, "refund", { sessionId, reason: "generation_failed" });
        return reply.status(500).send({ error: msg });
      }
    });
  };
}
