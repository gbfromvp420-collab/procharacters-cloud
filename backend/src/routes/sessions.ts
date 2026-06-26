import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listActiveCharacters } from "../lib/characters/registry.js";
import { CharacterNotFoundError } from "../lib/characters/loader.js";
import {
  LIVE_CHARACTER_CATALOG,
  LiveCharacterError,
  LivePromptInjector,
} from "../lib/live/index.js";
import type { LiveKitService } from "../lib/livekit/service.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
import { listManifestCharacters } from "../lib/prompts/manifest.js";
import type { MediaWorker } from "../services/media-worker.js";
import type { SessionManager } from "../services/session-manager.js";

const createSessionSchema = z.object({
  characterId: z.string().optional(),
  promptVersion: z.string().optional(),
});

const injector = new LivePromptInjector();

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

      return {
        live: Object.values(LIVE_CHARACTER_CATALOG).map((profile) => ({
          id: profile.id,
          displayName: profile.displayName,
          defaultVersion: profile.defaultVersion,
        })),
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

    app.post("/sessions", async (request, reply) => {
      const body = createSessionSchema.parse(request.body ?? {});
      const protocol = request.headers["x-forwarded-proto"] ?? "http";
      const host = request.headers.host ?? "localhost:3001";
      const wsProtocol = protocol === "https" ? "wss" : "ws";
      const wsBaseUrl = `${wsProtocol}://${host}`;

      try {
        const session = await sessionManager.createSession(body, wsBaseUrl);
        const record = sessionManager.getSession(session.sessionId);
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
          livekit: livekitJoin,
        });
      } catch (error) {
        if (error instanceof CharacterNotFoundError || error instanceof LiveCharacterError) {
          return reply.code(404).send({ error: error.message });
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
        sessionManager.getSession(sessionId);
        const identity = `user-${sessionId.slice(0, 8)}`;
        return await livekit.buildJoinInfo(sessionId, identity);
      } catch {
        return reply.code(404).send({ error: "Session not found" });
      }
    });

    app.get("/sessions/:sessionId", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      try {
        const session = sessionManager.getSession(sessionId);
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

      try {
        const session = sessionManager.getSession(sessionId);
        const context = SessionMemory.fromData(session.memory).getRecentContext();

        return {
          messageCount: context.messageCount,
          recentMessages: context.messages,
        };
      } catch {
        return reply.code(404).send({ error: "Session not found" });
      }
    });

    app.get("/sessions/:sessionId/prompt-preview", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      try {
        const session = sessionManager.getSession(sessionId);
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
        const session = sessionManager.endSession(sessionId);
        return { id: session.id, status: session.status };
      } catch {
        return reply.code(404).send({ error: "Session not found" });
      }
    });
  };
};