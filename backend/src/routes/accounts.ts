import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  AccountError,
  createAccount,
  loginAccount,
  logoutAccountToken,
  resolveAccountToken,
} from "../lib/accounts/account-store.js";
import {
  SessionAuthError,
  SessionNotFoundError,
  type SessionManager,
} from "../services/session-manager.js";
import type { LiveKitService } from "../lib/livekit/service.js";
import type { MediaWorker } from "../services/media-worker.js";

const credentialsSchema = z.object({
  handle: z.string().min(3).max(40),
  passphrase: z.string().min(6).max(200),
});

export function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

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
    typeof forwardedProto === "string" ? forwardedProto.split(",")[0]?.trim() : "http";
  const host = requestHost ?? "localhost:3001";
  const wsProtocol = protocol === "https" ? "wss" : "ws";
  return `${wsProtocol}://${host}`;
}

export const createAccountRoutes = (
  sessionManager: SessionManager,
  media: MediaWorker,
  livekit: LiveKitService,
): FastifyPluginAsync => {
  return async (app) => {
    app.post("/accounts/register", async (request, reply) => {
      try {
        const body = credentialsSchema.parse(request.body ?? {});
        const account = await createAccount(body.handle, body.passphrase);
        return reply.code(201).send({
          accountId: account.id,
          handle: account.handle,
          token: account.token,
          expiresAt: account.expiresAt,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof AccountError) {
          const status = error.code === "CONFLICT" ? 409 : error.code === "AUTH" ? 401 : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    });

    app.post("/accounts/login", async (request, reply) => {
      try {
        const body = credentialsSchema.parse(request.body ?? {});
        const account = await loginAccount(body.handle, body.passphrase);
        return {
          accountId: account.id,
          handle: account.handle,
          token: account.token,
          expiresAt: account.expiresAt,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof AccountError) {
          return reply.code(401).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    });

    app.post("/accounts/logout", async (request) => {
      const token = bearerToken(request);
      if (token) await logoutAccountToken(token);
      return { ok: true };
    });

    app.get("/accounts/me", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      return { accountId: account.id, handle: account.handle, createdAt: account.createdAt };
    });

    app.get("/accounts/me/sessions", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const sessions = await sessionManager.listAccountSessions(account.id);
      return { sessions };
    });

    app.post("/accounts/me/sessions/:sessionId/claim", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const { sessionId } = request.params as { sessionId: string };
      try {
        const claimed = await sessionManager.claimSessionForAccount(sessionId, account.id);
        return {
          sessionId: claimed.id,
          accountId: claimed.accountId,
          resumeCode: claimed.resumeCode,
        };
      } catch (error) {
        if (error instanceof SessionNotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    });

    app.post("/accounts/me/sessions/:sessionId/resume", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const { sessionId } = request.params as { sessionId: string };
      const wsBaseUrl = resolveWsBaseUrl(request.headers.host, request.headers["x-forwarded-proto"]);

      try {
        const session = await sessionManager.resumeForAccount(account.id, sessionId, wsBaseUrl);
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
        if (error instanceof SessionNotFoundError) {
          return reply.code(404).send({ error: "Session not found" });
        }
        if (error instanceof SessionAuthError) {
          return reply.code(403).send({ error: error.message });
        }
        throw error;
      }
    });
  };
};
