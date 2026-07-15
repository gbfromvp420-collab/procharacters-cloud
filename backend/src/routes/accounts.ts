import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  AccountError,
  accountHasPassphrase,
  createAccount,
  deleteAccount,
  getAccountPlanSummary,
  loginAccount,
  logoutAccountToken,
  requestMagicLink,
  resolveAccountToken,
  setAccountPassphrase,
  verifyMagicLink,
} from "../lib/accounts/account-store.js";
import {
  buildMagicLinkUrl,
  sendMagicLinkEmail,
  sendResumeLinksEmail,
  type ResumeLinkItem,
} from "../lib/accounts/mailer.js";
import {
  RATE_LIMITS,
  clientIp,
  enforceRateLimits,
} from "../lib/rate-limit.js";
import {
  buildAccountSessionsMarkdown,
  buildSessionMarkdown,
  exportFilename,
  parseExportFormat,
} from "../lib/memory/session-export.js";
import {
  SessionAuthError,
  SessionImportError,
  SessionNotFoundError,
  type SessionManager,
} from "../services/session-manager.js";
import type { LiveKitService } from "../lib/livekit/service.js";
import type { MediaWorker } from "../services/media-worker.js";
import {
  getAccountByEmail,
  upsertAccountByEmail,
} from "../lib/accounts/account-repo-prisma.js";

function rateLimited(
  reply: import("fastify").FastifyReply,
  result: { retryAfterSec: number; limit: number },
) {
  reply.header("Retry-After", String(result.retryAfterSec));
  reply.header("X-RateLimit-Limit", String(result.limit));
  return reply.code(429).send({
    error: "Too many requests — try again later",
    code: "RATE_LIMITED",
    retryAfterSec: result.retryAfterSec,
  });
}

const credentialsSchema = z.object({
  handle: z.string().min(3).max(40),
  passphrase: z.string().min(6).max(200),
});

const magicRequestSchema = z.object({
  email: z.string().email().max(200),
});

const magicVerifySchema = z.object({
  token: z.string().min(16).max(200),
});

const passphraseSchema = z.object({
  newPassphrase: z.string().min(6).max(200),
  currentPassphrase: z.string().min(6).max(200).optional(),
});

const deleteAccountSchema = z.object({
  /** Type DELETE to confirm permanent account removal. */
  confirm: z.literal("DELETE"),
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
      const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
      const denied = enforceRateLimits([
        {
          key: `auth:ip:${ip}`,
          limit: RATE_LIMITS.authPerIp.limit,
          windowMs: RATE_LIMITS.authPerIp.windowMs,
        },
      ]);
      if (denied) return rateLimited(reply, denied);

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
      const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
      const denied = enforceRateLimits([
        {
          key: `auth:ip:${ip}`,
          limit: RATE_LIMITS.authPerIp.limit,
          windowMs: RATE_LIMITS.authPerIp.windowMs,
        },
      ]);
      if (denied) return rateLimited(reply, denied);

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

    app.post("/accounts/magic/request", async (request, reply) => {
      try {
        const body = magicRequestSchema.parse(request.body ?? {});
        const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
        const emailKey = body.email.trim().toLowerCase();
        const denied = enforceRateLimits([
          {
            key: `magic:ip:${ip}`,
            limit: RATE_LIMITS.magicPerIp.limit,
            windowMs: RATE_LIMITS.magicPerIp.windowMs,
          },
          {
            key: `magic:email:${emailKey}`,
            limit: RATE_LIMITS.magicPerEmail.limit,
            windowMs: RATE_LIMITS.magicPerEmail.windowMs,
          },
        ]);
        if (denied) return rateLimited(reply, denied);

        const magic = await requestMagicLink(body.email);
// Best-effort Prisma sync (non-blocking)
try {
  await upsertAccountByEmail(magic.email.trim().toLowerCase());
} catch (e) {
  request.log.warn({ err: e }, "Prisma upsert failed in /accounts/magic/request");
}
        const siteBase =
          env.MAGIC_LINK_BASE_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          "https://procharacters-web-production-7288.up.railway.app";
        const magicUrl = buildMagicLinkUrl(magic.token, siteBase);
        const send = await sendMagicLinkEmail({
          to: magic.email,
          magicUrl,
          expiresAt: magic.expiresAt,
        });

        // Always safe: never leak token when email was actually delivered.
        const includeLink = !send.delivered || env.isDev;

        return {
          ok: true,
          email: magic.email,
          expiresAt: magic.expiresAt,
          delivered: send.delivered,
          provider: send.provider,
          isNewAccount: magic.isNewAccount,
          linking: magic.linking,
          // Dev / no-mailer fallback so Gary can still sign in without SMTP setup
          ...(includeLink ? { magicUrl, devHint: "Open this link to sign in (email not sent)" } : {}),
          ...(send.error ? { mailError: send.error } : {}),
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof AccountError) {
          const status = error.code === "CONFLICT" ? 409 : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    });

    /** Link an email to the currently signed-in handle/passphrase account. */
    app.post("/accounts/me/link-email", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      try {
        const body = magicRequestSchema.parse(request.body ?? {});
        const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
        const emailKey = body.email.trim().toLowerCase();
        const denied = enforceRateLimits([
          {
            key: `magic:ip:${ip}`,
            limit: RATE_LIMITS.magicPerIp.limit,
            windowMs: RATE_LIMITS.magicPerIp.windowMs,
          },
          {
            key: `magic:email:${emailKey}`,
            limit: RATE_LIMITS.magicPerEmail.limit,
            windowMs: RATE_LIMITS.magicPerEmail.windowMs,
          },
        ]);
        if (denied) return rateLimited(reply, denied);

        const magic = await requestMagicLink(body.email, { linkAccountId: account.id });
try {
  await upsertAccountByEmail(magic.email.trim().toLowerCase());
} catch (e) {
  request.log.warn({ err: e }, "Prisma upsert failed in /accounts/me/link-email");
}
        const siteBase =
          env.MAGIC_LINK_BASE_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          "https://procharacters-web-production-7288.up.railway.app";
        const magicUrl = buildMagicLinkUrl(magic.token, siteBase);
        const send = await sendMagicLinkEmail({
          to: magic.email,
          magicUrl,
          expiresAt: magic.expiresAt,
        });
        const includeLink = !send.delivered || env.isDev;
        return {
          ok: true,
          email: magic.email,
          expiresAt: magic.expiresAt,
          delivered: send.delivered,
          provider: send.provider,
          linking: true,
          ...(includeLink
            ? { magicUrl, devHint: "Open this link to confirm email on your account" }
            : {}),
          ...(send.error ? { mailError: send.error } : {}),
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof AccountError) {
          const status =
            error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    });

    app.post("/accounts/magic/verify", async (request, reply) => {
      const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
      const denied = enforceRateLimits([
        {
          key: `auth:ip:${ip}`,
          limit: RATE_LIMITS.authPerIp.limit,
          windowMs: RATE_LIMITS.authPerIp.windowMs,
        },
      ]);
      if (denied) return rateLimited(reply, denied);

      try {
        const body = magicVerifySchema.parse(request.body ?? {});
        const account = await verifyMagicLink(body.token);
if (account.email?.trim()) {
  try {
    await upsertAccountByEmail(account.email.trim().toLowerCase());
  } catch (e) {
    request.log.warn({ err: e }, "Prisma upsert failed in /accounts/magic/verify");
  }
}
        return {
          accountId: account.id,
          handle: account.handle,
          email: account.email,
          token: account.token,
          expiresAt: account.expiresAt,
          linked: account.linked === true,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof AccountError) {
          const status =
            error.code === "CONFLICT" ? 409 : error.code === "AUTH" ? 401 : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    });

    app.get("/accounts/me", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const plan = getAccountPlanSummary(account);
let prismaUserId: string | null = null;
if (account.email?.trim()) {
  try {
    const dbUser = await getAccountByEmail(account.email.trim().toLowerCase());
    prismaUserId = dbUser?.id ?? null;
  } catch (e) {
    request.log.warn({ err: e }, "Prisma lookup failed in /accounts/me");
  }
}
      return {
        accountId: account.id,
        handle: account.handle,
        email: account.email,
        createdAt: account.createdAt,
        hasPassphrase: accountHasPassphrase(account.id),
        plan: plan.plan,
        activePremium: plan.activePremium,
        planExpiresAt: plan.planExpiresAt,
        customsLimit: plan.customsLimit,
        prismaUserId,
      };
    });

    app.post("/accounts/me/passphrase", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      try {
        const body = passphraseSchema.parse(request.body ?? {});
        await setAccountPassphrase(account.id, {
          newPassphrase: body.newPassphrase,
          currentPassphrase: body.currentPassphrase,
        });
        return {
          ok: true,
          hasPassphrase: true,
          message: accountHasPassphrase(account.id)
            ? "Passphrase updated"
            : "Passphrase set",
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        if (error instanceof AccountError) {
          const status = error.code === "AUTH" ? 401 : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    });

    app.get("/accounts/me/sessions", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const sessions = await sessionManager.listAccountSessions(account.id);
      return { sessions };
    });

    /** Mint a new resume code for one saved chat (old code stops working). */
    app.post(
      "/accounts/me/sessions/:sessionId/refresh-resume",
      async (request, reply) => {
        const account = await resolveAccountToken(bearerToken(request));
        if (!account) {
          return reply.code(401).send({ error: "Not signed in" });
        }
        const { sessionId } = request.params as { sessionId: string };
        try {
          const result = await sessionManager.refreshSessionResumeCode(
            account.id,
            sessionId,
          );
          return { ok: true, ...result };
        } catch (error) {
          if (error instanceof SessionNotFoundError) {
            return reply.code(404).send({ error: "Session not found" });
          }
          if (error instanceof SessionAuthError) {
            return reply.code(403).send({ error: error.message });
          }
          throw error;
        }
      },
    );

    /** Rotate resume codes — all, or only expiring/expired within N days. */
    app.post("/accounts/me/sessions/refresh-resumes", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const bodySchema = z.object({
        onlyExpiring: z.boolean().optional(),
        withinDays: z.number().int().min(1).max(30).optional(),
      });
      let onlyExpiring = false;
      let withinDays: number | undefined;
      try {
        const body = bodySchema.parse(request.body ?? {});
        onlyExpiring = body.onlyExpiring === true;
        withinDays = body.withinDays;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.flatten() });
        }
        throw error;
      }
      const result = await sessionManager.refreshAllAccountResumeCodes(account.id, {
        onlyExpiring,
        withinDays,
      });
      return { ok: true, onlyExpiring, ...result };
    });

    /**
     * Email all resume links to the account's linked email (Resend).
     * Requires a linked email. Rate-limited per account.
     */
    app.post("/accounts/me/sessions/email-resumes", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      if (!account.email?.trim()) {
        return reply.code(400).send({
          error: "Link an email on this account first (magic link or link-email)",
          code: "EMAIL_REQUIRED",
        });
      }

      const denied = enforceRateLimits([
        {
          key: `resume-email:acct:${account.id}`,
          limit: RATE_LIMITS.resumeEmailPerAccount.limit,
          windowMs: RATE_LIMITS.resumeEmailPerAccount.windowMs,
        },
      ]);
      if (denied) return rateLimited(reply, denied);

      const siteBase =
        env.MAGIC_LINK_BASE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "https://procharacters-web-production-7288.up.railway.app";
      const base = siteBase.replace(/\/$/, "");

      const sessions = await sessionManager.listAccountSessions(account.id);
      const items: ResumeLinkItem[] = sessions
        .filter((s) => s.resumeCode)
        .map((s) => {
          const url = new URL(`${base}/chat`);
          url.searchParams.set("resume", s.resumeCode!);
          url.searchParams.set("character", s.characterId);
          return {
            characterName: s.characterName,
            characterId: s.characterId,
            resumeCode: s.resumeCode!,
            resumeUrl: url.toString(),
            messageCount: s.messageCount,
            status: s.status,
            expiresAt: s.resumeExpiresAt,
          };
        });

      if (items.length === 0) {
        return reply.code(400).send({
          error: "No resume codes to email — start a chat while signed in first",
          code: "EMPTY",
        });
      }

      const send = await sendResumeLinksEmail({
        to: account.email.trim(),
        handle: account.handle,
        items,
      });

      const includePreview = !send.delivered || env.isDev;

      return {
        ok: true,
        email: account.email.trim(),
        count: items.length,
        delivered: send.delivered,
        provider: send.provider,
        ...(send.error ? { mailError: send.error } : {}),
        ...(includePreview
          ? {
              // Dev / no-mailer: client can still download/show links
              preview: items.map((i) => ({
                characterName: i.characterName,
                resumeCode: i.resumeCode,
                resumeUrl: i.resumeUrl,
              })),
              devHint: send.delivered
                ? undefined
                : "Email not sent (no RESEND_API_KEY) — use Download resumes.md or links below",
            }
          : {}),
      };
    });

    /**
     * Latest saved chat for a character on this account (cross-device resume).
     * Resume codes are minted if missing so every device can share/open the same link.
     */
    app.get("/accounts/me/characters/:characterId/latest", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const { characterId } = request.params as { characterId: string };
      if (!characterId?.trim()) {
        return reply.code(400).send({ error: "characterId required" });
      }
      const latest = await sessionManager.latestAccountSessionForCharacter(
        account.id,
        characterId.trim(),
      );
      if (!latest) {
        return reply.code(404).send({ error: "No saved chat for this character" });
      }
      return latest;
    });

    /** Download all account chats as JSON or Markdown (?format=md). */
    app.get("/accounts/me/sessions/export", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const q = request.query as { format?: string };
      const format = parseExportFormat(q.format);
      const doc = await sessionManager.exportAccountSessions(account.id, account.handle);
      const day = new Date().toISOString().slice(0, 10);
      if (format === "md") {
        const md = buildAccountSessionsMarkdown(doc);
        const filename = `procharacters-all-chats-${account.handle}-${day}.md`;
        reply.header("Content-Disposition", `attachment; filename="${filename}"`);
        reply.header("Content-Type", "text/markdown; charset=utf-8");
        return reply.send(md);
      }
      const filename = `procharacters-all-chats-${account.handle}-${day}.json`;
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      reply.header("Content-Type", "application/json; charset=utf-8");
      return doc;
    });

    /** Dry-run import for account (no writes). */
    app.post("/accounts/me/sessions/import/preview", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const raw = request.body;
      let document: unknown = raw;
      let characterId: string | undefined;
      let characterMap: Record<string, string> | undefined;
      let fallbackCharacterId: string | undefined;
      let sessionIndex: number | undefined;
      let importAll: boolean | undefined;

      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const body = raw as Record<string, unknown>;
        if (body.document !== undefined) document = body.document;
        if (typeof body.characterId === "string") characterId = body.characterId;
        if (body.characterMap && typeof body.characterMap === "object" && !Array.isArray(body.characterMap)) {
          characterMap = body.characterMap as Record<string, string>;
        }
        if (typeof body.fallbackCharacterId === "string") {
          fallbackCharacterId = body.fallbackCharacterId;
        }
        if (typeof body.sessionIndex === "number") sessionIndex = body.sessionIndex;
        if (typeof body.importAll === "boolean") importAll = body.importAll;
      }

      try {
        const preview = sessionManager.previewImport(document, {
          characterId,
          characterMap,
          fallbackCharacterId,
          sessionIndex,
          importAll: importAll ?? (sessionIndex === undefined ? true : undefined),
        });
        return preview;
      } catch (error) {
        if (error instanceof SessionImportError) {
          return reply.code(400).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    });

    /** Restore export JSON onto this account as a new saved chat (then auto-resumable). */
    app.post("/accounts/me/sessions/import", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
      const denied = enforceRateLimits([
        {
          key: `import:ip:${ip}`,
          limit: RATE_LIMITS.importPerIp.limit,
          windowMs: RATE_LIMITS.importPerIp.windowMs,
        },
        {
          key: `import:acct:${account.id}`,
          limit: RATE_LIMITS.importPerIp.limit,
          windowMs: RATE_LIMITS.importPerIp.windowMs,
        },
      ]);
      if (denied) return rateLimited(reply, denied);

      const wsBaseUrl = resolveWsBaseUrl(request.headers.host, request.headers["x-forwarded-proto"]);
      const raw = request.body;
      let document: unknown = raw;
      let characterId: string | undefined;
      let characterMap: Record<string, string> | undefined;
      let fallbackCharacterId: string | undefined;
      let sessionIndex: number | undefined;
      let importAll: boolean | undefined;
      let openIndex: number | undefined;

      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const body = raw as Record<string, unknown>;
        if (body.document !== undefined) document = body.document;
        if (typeof body.characterId === "string") characterId = body.characterId;
        if (body.characterMap && typeof body.characterMap === "object" && !Array.isArray(body.characterMap)) {
          characterMap = body.characterMap as Record<string, string>;
        }
        if (typeof body.fallbackCharacterId === "string") {
          fallbackCharacterId = body.fallbackCharacterId;
        }
        if (typeof body.sessionIndex === "number") sessionIndex = body.sessionIndex;
        if (typeof body.importAll === "boolean") importAll = body.importAll;
        if (typeof body.openIndex === "number") openIndex = body.openIndex;
      }

      try {
        // Account bulk exports default to import-all (every chat restored + owned).
        const session = await sessionManager.importSession(document, wsBaseUrl, {
          accountId: account.id,
          characterId,
          characterMap,
          fallbackCharacterId,
          openIndex,
          sessionIndex,
          importAll: importAll ?? (sessionIndex === undefined ? true : undefined),
        });
        const avatarState = media.enrich(session.characterId, session.avatarState);
        sessionManager.updateSession(session.sessionId, { avatarState });

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
        if (error instanceof SessionAuthError) {
          return reply.code(403).send({ error: error.message });
        }
        throw error;
      }
    });

    /** Download one saved chat as JSON or Markdown (?format=md). */
    app.get("/accounts/me/sessions/:sessionId/export", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const { sessionId } = request.params as { sessionId: string };
      const q = request.query as { format?: string };
      const format = parseExportFormat(q.format);
      try {
        const doc = await sessionManager.exportSession({
          sessionId,
          accountId: account.id,
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
        if (error instanceof SessionNotFoundError) {
          return reply.code(404).send({ error: "Session not found" });
        }
        if (error instanceof SessionAuthError) {
          return reply.code(403).send({ error: error.message });
        }
        throw error;
      }
    });

    app.delete("/accounts/me/sessions", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const deleted = await sessionManager.wipeAccountSessions(account.id);
      return { ok: true, deleted };
    });

    app.delete("/accounts/me/sessions/:sessionId", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const { sessionId } = request.params as { sessionId: string };
      try {
        await sessionManager.deleteSessionForAccount(account.id, sessionId);
        return { ok: true, sessionId };
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

    app.delete("/accounts/me", async (request, reply) => {
      const token = bearerToken(request);
      const account = await resolveAccountToken(token);
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      try {
        deleteAccountSchema.parse(request.body ?? {});
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'Send JSON body { "confirm": "DELETE" } to permanently delete this account',
          });
        }
        throw error;
      }

      const wiped = await sessionManager.wipeAccountSessions(account.id);
      await deleteAccount(account.id);
      if (token) await logoutAccountToken(token);

      return {
        ok: true,
        deleted: true,
        sessionsWiped: wiped,
        message: "Account and saved chats permanently deleted",
      };
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

    /**
     * Phase 6: opt-in cross-session memory notes for a character.
     * When optIn=true, future notes from chats with this character are saved
     * and can seed new sessions via useCrossSessionMemory on create.
     */
    app.get("/accounts/me/memory/:characterId", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const { characterId } = request.params as { characterId: string };
      const {
        getCrossSessionNote,
      } = await import("../lib/memory/cross-session-notes.js");
      const note = await getCrossSessionNote(account.id, characterId);
      return {
        characterId,
        optIn: note?.optIn === true,
        notes: note?.notes ?? "",
        updatedAt: note?.updatedAt ?? null,
      };
    });

    app.put("/accounts/me/memory/:characterId", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const { characterId } = request.params as { characterId: string };
      const body = z
        .object({
          optIn: z.boolean(),
        })
        .parse(request.body ?? {});
      const {
        setCrossSessionOptIn,
      } = await import("../lib/memory/cross-session-notes.js");
      const note = await setCrossSessionOptIn(account.id, characterId, body.optIn);
      return {
        characterId,
        optIn: note.optIn,
        notes: note.notes,
        updatedAt: note.updatedAt,
      };
    });

    /** Forget me — clear long-term dossier for this character (opt-in can stay on). */
    app.delete("/accounts/me/memory/:characterId", async (request, reply) => {
      const account = await resolveAccountToken(bearerToken(request));
      if (!account) {
        return reply.code(401).send({ error: "Not signed in" });
      }
      const { characterId } = request.params as { characterId: string };
      const query = request.query as { optOut?: string };
      const optOut = query.optOut === "1" || query.optOut === "true";
      const {
        clearCrossSessionNotes,
      } = await import("../lib/memory/cross-session-notes.js");
      const note = await clearCrossSessionNotes(account.id, characterId, { optOut });
      return {
        characterId,
        cleared: true,
        optIn: note.optIn,
        notes: note.notes,
        updatedAt: note.updatedAt,
      };
    });
  };
};

