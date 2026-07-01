/**
 * Custom character API routes — create, list, get, delete user characters.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/auth/index.js";
import type { CustomCharacterService } from "../services/custom-character-service.js";

const appearanceSchema = z.object({
  bodyType: z.string().min(1).max(100),
  hairColor: z.string().min(1).max(50),
  hairStyle: z.string().min(1).max(50),
  eyeColor: z.string().min(1).max(50),
  skinTone: z.string().min(1).max(50),
  extras: z.string().max(200).optional(),
});

const personalitySchema = z.object({
  energy: z.array(z.string().min(1).max(50)).min(1).max(5),
  tone: z.string().min(1).max(100),
  style: z.string().min(1).max(100),
  kinks: z.array(z.string().min(1).max(50)).max(10).optional(),
});

const createCharacterSchema = z.object({
  name: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(50),
  description: z.string().min(10).max(500),
  appearance: appearanceSchema,
  personality: personalitySchema,
  signatureClothing: z.string().min(1).max(100),
});

export function createCustomCharacterRoutes(service: CustomCharacterService) {
  return async (app: FastifyInstance) => {
    /** List user's custom characters. */
    app.get("/characters/custom", { preHandler: [requireAuth] }, async (request) => {
      const characters = service.listByUser(request.user!.userId);
      return { characters };
    });

    /** Create a custom character. */
    app.post("/characters/custom", { preHandler: [requireAuth] }, async (request, reply) => {
      const parsed = createCharacterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const character = service.create(request.user!.userId, parsed.data);
      return reply.status(201).send({ character });
    });

    /** Get a specific custom character. */
    app.get<{ Params: { characterId: string } }>(
      "/characters/custom/:characterId",
      { preHandler: [requireAuth] },
      async (request, reply) => {
        const character = service.get(request.params.characterId);
        if (!character || character.userId !== request.user!.userId) {
          return reply.status(404).send({ error: "Character not found" });
        }
        return { character };
      },
    );

    /** Delete a custom character. */
    app.delete<{ Params: { characterId: string } }>(
      "/characters/custom/:characterId",
      { preHandler: [requireAuth] },
      async (request, reply) => {
        const deleted = service.delete(request.params.characterId, request.user!.userId);
        if (!deleted) {
          return reply.status(404).send({ error: "Character not found" });
        }
        return { success: true };
      },
    );
  };
}
