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
  getCustomCharacter,
  listCustomCharacters,
  updateCustomCharacter,
} from "../lib/live/index.js";
import { listClipUrls } from "../lib/media/clip-resolver.js";
import type { LiveKitService } from "../lib/livekit/service.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
import { listManifestCharacters } from "../lib/prompts/manifest.js";
import type { MediaWorker } from "../services/media-worker.js";
import { resolveAccountToken } from "../lib/accounts/account-store.js";
import {
  buildSessionMarkdown,
  exportFilename,
  parseExportFormat,
} from "../lib/memory/session-export.js";
import {
  RATE_LIMITS,
  clientIp,
  enforceRateLimits,
} from "../lib/rate-limit.js";
import {
  SessionAuthError,
  SessionImportError,
  SessionNotFoundError,
  type SessionManager,
} from "../services/session-manager.js";
import { bearerToken } from "./accounts.js";

const createSessionSchema = z.object({
  characterId: z.string().optional(),
  promptVersion: z.string().optional(),
});

const resumeSessionSchema = z.object({
  token: z.string().min(8),
});

const resumeCodeSchema = z.object({
  code: z.string().min(6).max(16),
});

const exportSessionSchema = z.object({
  /** Current ws session token (guest or signed-in live chat). */
  token: z.string().min(8),
  /** json (default) or md */
  format: z.enum(["json", "md", "markdown"]).optional(),
});

const importSessionSchema = z.object({
  /** Full export document, bulk export, or bare session object. */
  document: z.unknown().optional(),
  /** Optional character override when original id is gone. */
  characterId: z.string().min(2).max(80).optional(),
  /** Which session in a bulk export (forces single when set). */
  sessionIndex: z.number().int().min(0).max(99).optional(),
  /**
   * Restore every chat from a bulk account export (default true when bulk + no index).
   * Set false to import only sessionIndex (or 0).
   */
  importAll: z.boolean().optional(),
});

const mediaOverridesSchema = z
  .object({
    idle: z.string().min(1).max(500).optional(),
    teasing: z.string().min(1).max(500).optional(),
    playful: z.string().min(1).max(500).optional(),
    aroused: z.string().min(1).max(500).optional(),
  })
  .optional();

const createCustomCharacterSchema = z.object({
  name: z.string().min(2).max(80),
  appearance: z.string().min(12).max(2000),
  energy: z.string().min(4).max(500).optional(),
  clothing: z.string().min(2).max(200).optional(),
  avatarBase: z.enum(["twink-default", "female-default"]).optional(),
  audience: z.enum(["gay", "bi", "straight", "any"]).optional(),
  mediaBase: z.string().min(1).max(300).optional(),
  mediaOverrides: mediaOverridesSchema,
  featured: z.boolean().optional(),
});

const updateCustomCharacterSchema = z.object({
  mediaBase: z.string().max(300).nullable().optional(),
  mediaOverrides: mediaOverridesSchema.nullable(),
  energy: z.string().min(4).max(500).optional(),
  clothing: z.string().min(2).max(200).optional(),
  featured: z.boolean().optional(),
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
    app.get("/characters/gallery", async () => {
      const brandTeasers: Record<string, string> = {
        "twink-default":
          "Skinny Latino twink energy — sheer thong, slow edging, photorealistic tease.",
        "female-default":
          "Fit athletic tease — crotchless undies, wet anticipation, uncensored heat.",
      };

      const defaults = Object.values(LIVE_CHARACTER_CATALOG).map((profile) => {
        const clips = listClipUrls(profile.id);
        return {
          id: profile.id,
          displayName: profile.displayName,
          kind: "default" as const,
          brand: "Naughty Syntax",
          energyLabel: profile.energyLabel,
          teaser: brandTeasers[profile.id] ?? profile.energyLabel,
          tags: profile.consistencyTraits.slice(0, 4),
          avatarBase: profile.avatarBase ?? profile.id,
          posterClip: clips.teasing || clips.idle,
          clips,
          featured: true,
          ctaPath: `/chat?character=${encodeURIComponent(profile.id)}&autostart=1`,
          cardPath: `/character/${encodeURIComponent(profile.id)}`,
        };
      });

      const customs = listCustomCharacters().map((profile) => {
        const clips = listClipUrls(profile.id);
        const teaser =
          profile.appearance.length > 160
            ? `${profile.appearance.slice(0, 157).trim()}…`
            : profile.appearance;
        return {
          id: profile.id,
          displayName: profile.displayName,
          kind: "custom" as const,
          brand: "Naughty Syntax",
          energyLabel: profile.energyLabel,
          teaser,
          tags: profile.consistencyTraits.slice(0, 4),
          avatarBase: profile.avatarBase,
          posterClip: clips.teasing || clips.idle,
          clips,
          featured: profile.featured === true,
          ctaPath: `/chat?character=${encodeURIComponent(profile.id)}&autostart=1`,
          cardPath: `/character/${encodeURIComponent(profile.id)}`,
        };
      });

      const characters = [...defaults, ...customs];
      const featured = characters.filter((c) => c.featured);

      return {
        brand: "Naughty Syntax",
        title: "Live character gallery",
        count: characters.length,
        featured,
        characters,
      };
    });

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
        mediaBase: profile.mediaBase,
        mediaOverrides: profile.mediaOverrides,
        featured: profile.featured === true,
        clips: listClipUrls(profile.id),
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
            featured: true,
            clips: listClipUrls(profile.id),
          })),
          ...custom,
        ],
        custom,
        clipPacks: [
          {
            id: "twink-default",
            label: "Twink Default pack",
            mediaBase: "/avatar/twink-default",
          },
          {
            id: "female-default",
            label: "Female Default pack",
            mediaBase: "/avatar/female-default",
          },
        ],
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
          mediaBase: created.mediaBase,
          mediaOverrides: created.mediaOverrides,
          featured: created.featured === true,
          clips: listClipUrls(created.id),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        const message = error instanceof Error ? error.message : "Failed to create character";
        return reply.code(400).send({ error: message });
      }
    });

    app.patch("/characters/custom/:characterId", async (request, reply) => {
      const { characterId } = request.params as { characterId: string };
      if (!characterId.startsWith("custom-")) {
        return reply.code(400).send({ error: "Only custom characters can be updated" });
      }
      try {
        const body = updateCustomCharacterSchema.parse(request.body ?? {});
        const updated = await updateCustomCharacter(characterId, body);
        return {
          id: updated.id,
          displayName: updated.displayName,
          kind: "custom",
          avatarBase: updated.avatarBase,
          mediaBase: updated.mediaBase,
          mediaOverrides: updated.mediaOverrides,
          featured: updated.featured === true,
          clips: listClipUrls(updated.id),
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        const message = error instanceof Error ? error.message : "Failed to update character";
        if (message.includes("not found")) {
          return reply.code(404).send({ error: message });
        }
        return reply.code(400).send({ error: message });
      }
    });

    app.get("/characters/:characterId/clips", async (request, reply) => {
      const { characterId } = request.params as { characterId: string };
      const isDefault = characterId in LIVE_CHARACTER_CATALOG;
      const isCustom = !!getCustomCharacter(characterId);
      if (!isDefault && !isCustom) {
        return reply.code(404).send({ error: "Character not found" });
      }
      return {
        characterId,
        clips: listClipUrls(characterId),
        mediaBase: getCustomCharacter(characterId)?.mediaBase,
        mediaOverrides: getCustomCharacter(characterId)?.mediaOverrides,
        avatarBase:
          getCustomCharacter(characterId)?.avatarBase ??
          LIVE_CHARACTER_CATALOG[characterId]?.avatarBase ??
          characterId,
      };
    });

    /** Public share-card payload for pretty character pages / OG previews. */
    app.get("/characters/:characterId/card", async (request, reply) => {
      const { characterId } = request.params as { characterId: string };
      const builtIn = LIVE_CHARACTER_CATALOG[characterId];
      const custom = getCustomCharacter(characterId);

      if (!builtIn && !custom) {
        return reply.code(404).send({ error: "Character not found" });
      }

      const clips = listClipUrls(characterId);
      const brandTeasers: Record<string, string> = {
        "twink-default":
          "Skinny Latino twink energy — sheer thong, slow edging, photorealistic tease.",
        "female-default":
          "Fit athletic tease — crotchless undies, wet anticipation, uncensored heat.",
      };

      if (custom) {
        const teaser =
          custom.appearance.length > 180
            ? `${custom.appearance.slice(0, 177).trim()}…`
            : custom.appearance;
        return {
          id: custom.id,
          displayName: custom.displayName,
          kind: "custom" as const,
          brand: "Naughty Syntax",
          energyLabel: custom.energyLabel,
          teaser,
          tags: custom.consistencyTraits.slice(0, 4),
          avatarBase: custom.avatarBase,
          posterClip: clips.teasing || clips.idle,
          clips,
          featured: custom.featured === true,
          ctaPath: `/chat?character=${encodeURIComponent(custom.id)}&autostart=1`,
          cardPath: `/character/${encodeURIComponent(custom.id)}`,
        };
      }

      return {
        id: builtIn!.id,
        displayName: builtIn!.displayName,
        kind: "default" as const,
        brand: "Naughty Syntax",
        energyLabel: builtIn!.energyLabel,
        teaser: brandTeasers[builtIn!.id] ?? builtIn!.energyLabel,
        tags: builtIn!.consistencyTraits.slice(0, 4),
        avatarBase: builtIn!.avatarBase ?? builtIn!.id,
        posterClip: clips.teasing || clips.idle,
        clips,
        featured: true,
        ctaPath: `/chat?character=${encodeURIComponent(builtIn!.id)}&autostart=1`,
        cardPath: `/character/${encodeURIComponent(builtIn!.id)}`,
      };
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
      const account = await resolveAccountToken(bearerToken(request));

      try {
        const session = await sessionManager.createSession(
          { ...body, accountId: account?.id },
          wsBaseUrl,
        );
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

    /**
     * Restore a chat from export JSON into a new live session.
     * Body may be the export itself, or { document, characterId?, sessionIndex? }.
     * Optional Bearer account token attaches the new session to the account.
     */
    app.post("/sessions/import", async (request, reply) => {
      const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
      const denied = enforceRateLimits([
        {
          key: `import:ip:${ip}`,
          limit: RATE_LIMITS.importPerIp.limit,
          windowMs: RATE_LIMITS.importPerIp.windowMs,
        },
      ]);
      if (denied) {
        reply.header("Retry-After", String(denied.retryAfterSec));
        return reply.code(429).send({
          error: "Import rate limit exceeded — try again later",
          code: "RATE_LIMITED",
          retryAfterSec: denied.retryAfterSec,
        });
      }

      const wsBaseUrl = resolveWsBaseUrl(request.headers.host, request.headers["x-forwarded-proto"]);
      const account = await resolveAccountToken(bearerToken(request));
      const raw = request.body;

      let document: unknown = raw;
      let characterId: string | undefined;
      let sessionIndex: number | undefined;
      let importAll: boolean | undefined;

      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const parsedWrap = importSessionSchema.safeParse(raw);
        if (parsedWrap.success && (parsedWrap.data.document !== undefined || "schema" in raw)) {
          if (parsedWrap.data.document !== undefined) {
            document = parsedWrap.data.document;
          }
          characterId = parsedWrap.data.characterId;
          sessionIndex = parsedWrap.data.sessionIndex;
          importAll = parsedWrap.data.importAll;
        }
      }

      try {
        const session = await sessionManager.importSession(document, wsBaseUrl, {
          accountId: account?.id,
          characterId,
          sessionIndex,
          importAll,
        });
        const avatarState = media.enrich(session.characterId, session.avatarState);
        sessionManager.updateSession(session.sessionId, { avatarState });

        // Enrich LiveKit for primary (opened) session only
        let livekitJoin;
        if (livekit.isConfigured) {
          const identity = `user-${session.sessionId.slice(0, 8)}`;
          livekitJoin = await livekit.buildJoinInfo(session.sessionId, identity);
          await media.publish(session.sessionId, session.characterId, avatarState);
        }

        return reply.code(201).send({
          ...session,
          avatarState,
          livekit: livekitJoin,
        });
      } catch (error) {
        if (error instanceof SessionImportError) {
          return reply.code(400).send({ error: error.message, code: error.code });
        }
        if (error instanceof CharacterNotFoundError || error instanceof LiveCharacterError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof SessionAuthError) {
          return reply.code(403).send({ error: error.message });
        }
        throw error;
      }
    });

    app.post("/sessions/resume-code", async (request, reply) => {
      const wsBaseUrl = resolveWsBaseUrl(request.headers.host, request.headers["x-forwarded-proto"]);
      try {
        const body = resumeCodeSchema.parse(request.body ?? {});
        const session = await sessionManager.resumeByCode(body.code, wsBaseUrl);
        const avatarState = media.enrich(session.characterId, session.avatarState);
        sessionManager.updateSession(session.sessionId, { avatarState });

        let livekitJoin;
        if (livekit.isConfigured) {
          const identity = `user-${session.sessionId.slice(0, 8)}`;
          livekitJoin = await livekit.buildJoinInfo(session.sessionId, identity);
          await media.publish(session.sessionId, session.characterId, avatarState);
        }

        return { ...session, avatarState, livekit: livekitJoin };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof SessionNotFoundError) {
          return reply.code(404).send({ error: "Unknown resume code" });
        }
        if (error instanceof SessionAuthError || error instanceof LiveCharacterError) {
          return reply.code(403).send({ error: error.message });
        }
        throw error;
      }
    });

    /**
     * Export transcript as JSON or Markdown (body.format=md) without secrets.
     * Auth with body.token (wsToken) so guests can download mid-chat.
     */
    app.post("/sessions/:sessionId/export", async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      try {
        const body = exportSessionSchema.parse(request.body ?? {});
        const format = parseExportFormat(body.format);
        const doc = await sessionManager.exportSession({
          sessionId,
          token: body.token,
        });
        const filename = exportFilename(
          doc.session.characterName,
          sessionId,
          format === "md" ? "md" : "json",
        );
        reply.header("Content-Disposition", `attachment; filename="${filename}"`);
        if (format === "md") {
          reply.header("Content-Type", "text/markdown; charset=utf-8");
          return reply.send(
            buildSessionMarkdown(doc.session, { exportedAt: doc.exportedAt }),
          );
        }
        reply.header("Content-Type", "application/json; charset=utf-8");
        return doc;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof SessionNotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof SessionAuthError) {
          return reply.code(403).send({ error: error.message });
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