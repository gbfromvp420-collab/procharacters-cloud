import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { listActiveCharacters } from "../lib/characters/registry.js";
import { CharacterNotFoundError } from "../lib/characters/loader.js";
import {
  LIVE_CHARACTER_CATALOG,
  LiveCharacterError,
  LivePromptInjector,
  createCustomCharacter,
  deleteCustomCharacter,
  listCustomCharacters,
} from "../lib/live/index.js";
import type { LiveKitService } from "../lib/livekit/service.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
import { listManifestCharacters } from "../lib/prompts/manifest.js";
import type { MediaWorker } from "../services/media-worker.js";
import {
  SessionAuthError,
  SessionNotFoundError,
  type SessionManager,
} from "../services/session-manager.js";

const createSessionSchema = z.object({
  characterId: z.string().optional(),
  promptVersion: z.string().optional(),
});

const resumeSessionSchema = z.object({
  token: z.string().min(8),
});

const createCustomCharacterSchema = z.object({
  name: z.string().min(2).max(80),
  appearance: z.string().min(12).max(2000),
  energy: z.string().min(4).max(500).optional(),
  clothing: z.string().min(2).max(200).optional(),
  avatarBase: z.enum(["twink-default", "female-default"]).optional(),
  audience: z.enum(["gay", "bi", "straight", "any"]).optional(),
});

const injector = new LivePromptInjector();

function resolveWsBaseUrl(
  requestHost: string | undefined,
  forwardedProto: string | string[] | undefined,
): string {
  if (env.PUBLIC_API_URL) {
    const publicUrl = new URL(env.PUBLIC_API_URL);
    const wsProtocol = publicUrl.protocol === "https:" ? "wss" : "ws";
    return `${wsProtocol}://${publicUrl.host}`;
  }

  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : "http";
  const host = requestHost ?? "localhost:3001";
  const wsProtocol = protocol === "https" ? "wss" : "ws";
  return `${wsProtocol}://${host}`;
}

export const createSessionRoutes = (
  sessionManager: SessionManager,
  media: MediaWorker,
  livekit: LiveKitService,
): FastifyPluginAsync => {
  return async (app) => {
    app.get("/characters", async () => {
      const [registry, manifest] = await Promise.all([
        listActiveCharacters(),
        listManifestCharacters(),
      ]);

      const custom = listCustomCharacters().map((profile) => ({
        id: profile.id,
        displayName: profile.displayName,
        defaultVersion: profile.defaultVersion,
        kind: "custom" as const,
        avatarBase: profile.avatarBase,
        energyLabel: profile.energyLabel,
      }));

      return {
        live: [
          ...Object.values(LIVE_CHARACTER_CATALOG).map((profile) => ({
            id: profile.id,
            displayName: profile.displayName,
            defaultVersion: profile.defaultVersion,
            kind: "default" as const,
            avatarBase: profile.avatarBase ?? profile.id,
            energyLabel: profile.energyLabel,
          })),
          ...custom,
        ],
        custom,
        registry: registry.map((entry) => ({
          id: entry.id,
          name: entry.name,
          promptRef: entry.prompt_ref,
          status: entry.status,
        })),
        prompts: manifest.map((entry) => ({
          id: entry.id,
          name: entry.name,
          currentVersion: entry.current_version,
          path: entry.path,
        })),
      };
    });

    app.post("/characters/custom", async (request, reply) => {
      try {
        const body = createCustomCharacterSchema.parse(request.body ?? {});
        const created = await createCustomCharacter(body);
        return reply.code(201).send({
          id: created.id,
          displayName: created.displayName,
          defaultVersion: created.defaultVersion,
          kind: "custom",
          avatarBase: created.avatarBase,
          energyLabel: created.energyLabel,
          signatureClothing: created.signatureClothing,
          consistencyTraits: created.consistencyTraits,
          createdAt: created.createdAt,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        const message = error instanceof Error ? error.message : "Failed to create character";
        return reply.code(400).send({ error: message });
      }
    });

    app.delete("/characters/custom/:characterId", async (request, reply) => {
      const { characterId } = request.params as { characterId: string };
      if (!characterId.startsWith("custom-")) {
        return reply.code(400).send({ error: "Only custom characters can be deleted" });
      }
      const removed = await deleteCustomCharacter(characterId);
      if (!removed) {
        return reply.code(404).send({ error: "Custom character not found" });
      }
      return { ok: true, id: characterId };
    });

    app.post("/sessions", async (request, reply) => {
      const body = createSessionSchema.parse(request.body ?? {});
      const wsBaseUrl = resolveWsBaseUrl(request.headers.host, request.headers["x-forwarded-proto"]);

      try {
        const session = await sessionManager.createSession(body, wsBaseUrl);
        const record = await sessionManager.getSessionAsync(session.sessionId);
        const avatarState = media.enrich(record.characterId, record.avatarState);

        sessionManager.updateSession(session.sessionId, { avatarState });

        let livekitJoin;
        if (livekit.isConfigured) {
          const identity = `user-${session.sessionId.slice(0, 8)}`;
          livekitJoin = await livekit.buildJoinInfo(session.sessionId, identity);
          await media.publish(session.sessionId, record.characterId, avatarState);
        }

        return reply.code(201).send({
          ...session,
          avatarState,
          messages: [],
          livekit: livekitJoin,
        });
      } catch (error) {
        if (error instanceof CharacterNotFoundError || error instanceof LiveCharacterError) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    });

    app.post("/sessions/:sessionId/resume", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const wsBaseUrl = resolveWsBaseUrl(request.headers.host, request.headers["x-forwarded-proto"]);

      try {
        const body = resumeSessionSchema.parse(request.body ?? {});
        const session = await sessionManager.resumeSession(sessionId, body.token, wsBaseUrl);
        const avatarState = media.enrich(session.characterId, session.avatarState);
        sessionManager.updateSession(session.sessionId, { avatarState });

        let livekitJoin;
        if (livekit.isConfigured) {
          const identity = `user-${session.sessionId.slice(0, 8)}`;
          livekitJoin = await livekit.buildJoinInfo(session.sessionId, identity);
          await media.publish(session.sessionId, session.characterId, avatarState);
        }

        return {
          ...session,
          avatarState,
          livekit: livekitJoin,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof SessionNotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof SessionAuthError || error instanceof LiveCharacterError) {
          return reply.code(403).send({ error: error.message });
        }
        throw error;
      }
    });

    app.get("/sessions/:sessionId/livekit-token", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      if (!livekit.isConfigured) {
        return reply.code(503).send({ error: "LiveKit is not configured on this server" });
      }

      try {
        await sessionManager.getSessionAsync(sessionId);
        const identity = `user-${sessionId.slice(0, 8)}`;
        return await livekit.buildJoinInfo(sessionId, identity);
      } catch {
        return reply.code(404).send({ error: "Session not found" });
      }
    });

    app.get("/sessions/:sessionId", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      try {
        const session = await sessionManager.getSessionAsync(sessionId);
        const memory = SessionMemory.fromData(session.memory);

        return {
          id: session.id,
          characterId: session.characterId,
          characterName: session.promptSnapshot.characterName,
          promptVersion: session.promptVersion,
          status: session.status,
          messageCount: memory.getRecentContext().messageCount,
          avatarState: session.avatarState,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        };
      } catch {
        return reply.code(404).send({ error: "Session not found" });
      }
    });

    app.get("/sessions/:sessionId/memory", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const token =
        typeof request.query === "object" && request.query && "token" in request.query
          ? String((request.query as { token?: string }).token ?? "")
          : "";

      try {
        if (token) {
          await sessionManager.authenticateAsync(sessionId, token, { requireActive: false });
        }
        const session = await sessionManager.getSessionAsync(sessionId);
        const context = SessionMemory.fromData(session.memory).getRecentContext();

        return {
          messageCount: context.messageCount,
          recentMessages: context.messages,
          characterId: session.characterId,
          characterName: session.promptSnapshot.characterName,
          status: session.status,
        };
      } catch (error) {
        if (error instanceof SessionAuthError) {
          return reply.code(403).send({ error: error.message });
        }
        return reply.code(404).send({ error: "Session not found" });
      }
    });

    app.get("/sessions/:sessionId/prompt-preview", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      try {
        const session = await sessionManager.getSessionAsync(sessionId);
        const context = SessionMemory.fromData(session.memory).getRecentContext();
        const injection = injector.injectTurn(session.promptSnapshot, { context });

        return {
          turnNumber: injection.turnNumber,
          messageCount: injection.messages.length,
          memoryPreview: injection.layers.memory,
          conversationPreview: injection.messages
            .filter((m) => m.role !== "system")
            .slice(-4),
        };
      } catch {
        return reply.code(404).send({ error: "Session not found" });
      }
    });

    app.post("/sessions/:sessionId/end", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      try {
        // Ensure hydrated from disk before ending
        await sessionManager.getSessionAsync(sessionId);
        const session = sessionManager.endSession(sessionId);
        return {
          id: session.id,
          status: session.status,
          messageCount: session.memory.messages?.length ?? 0,
          resumable: true,
        };
      } catch {
        return reply.code(404).send({ error: "Session not found" });
      }
    });
  };
};