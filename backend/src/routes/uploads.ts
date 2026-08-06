import multipart from "@fastify/multipart";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import type { MediaClipKey, MediaOverrides } from "../lib/live/custom-characters.js";
import { getCustomCharacter, updateCustomCharacter } from "../lib/live/index.js";
import { listClipUrls } from "../lib/media/clip-resolver.js";
import { assertDeclaredClipMime } from "../lib/media/clip-validate.js";
import {
  isClipKey,
  saveCharacterClip,
  toPublicMediaUrl,
} from "../lib/media/upload-store.js";
import {
  accountHasActivePremium,
  resolveAccountToken,
} from "../lib/accounts/account-store.js";
import {
  RATE_LIMITS,
  clientIp,
  enforceRateLimits,
} from "../lib/rate-limit.js";
import { bearerToken } from "./accounts.js";

function rateLimited(
  reply: FastifyReply,
  result: { retryAfterSec: number; limit: number },
) {
  reply.header("Retry-After", String(result.retryAfterSec));
  reply.header("X-RateLimit-Limit", String(result.limit));
  return reply.code(429).send({
    error: "Upload rate limit exceeded — try again later",
    code: "RATE_LIMITED",
    retryAfterSec: result.retryAfterSec,
  });
}

async function checkUploadLimits(
  request: FastifyRequest,
  characterId: string,
): Promise<ReturnType<typeof enforceRateLimits>> {
  const ip = clientIp(request.headers as Record<string, string | string[] | undefined>);
  const account = await resolveAccountToken(bearerToken(request));
  const premium = accountHasActivePremium(account);
  const ipLimit = premium
    ? Math.round(RATE_LIMITS.uploadPerIp.limit * 2.5)
    : RATE_LIMITS.uploadPerIp.limit;
  const charLimit = premium
    ? Math.round(RATE_LIMITS.uploadPerCharacter.limit * 2.5)
    : RATE_LIMITS.uploadPerCharacter.limit;
  return enforceRateLimits([
    {
      key: `upload:ip:${ip}`,
      limit: ipLimit,
      windowMs: RATE_LIMITS.uploadPerIp.windowMs,
    },
    {
      key: `upload:char:${characterId}`,
      limit: charLimit,
      windowMs: RATE_LIMITS.uploadPerCharacter.windowMs,
    },
  ]);
}

/** Private My Characters: only the owner may upload / overwrite clips. */
async function assertClipUploadAllowed(
  request: FastifyRequest,
  characterId: string,
): Promise<{ ok: true; accountId?: string } | { ok: false; status: number; error: string; code: string }> {
  const existing = getCustomCharacter(characterId);
  if (!existing) {
    return { ok: false, status: 404, error: "Custom character not found", code: "NOT_FOUND" };
  }
  if (!existing.ownerAccountId) {
    return { ok: true };
  }
  const account = await resolveAccountToken(bearerToken(request));
  if (!account) {
    return {
      ok: false,
      status: 401,
      error: "Sign in to upload clips for a private My Character",
      code: "AUTH_REQUIRED",
    };
  }
  if (existing.ownerAccountId !== account.id) {
    return {
      ok: false,
      status: 403,
      error: "Not allowed to upload clips for this character",
      code: "FORBIDDEN",
    };
  }
  return { ok: true, accountId: account.id };
}

const CLIP_KEYS: MediaClipKey[] = ["idle", "teasing", "playful", "aroused"];

function requestPublicBase(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : env.PUBLIC_API_URL?.startsWith("https")
        ? "https"
        : "http";
  return (
    env.PUBLIC_API_URL?.replace(/\/$/, "") ||
    `${proto}://${request.headers.host ?? "localhost:3001"}`
  );
}

/** Infer emotion from fieldname (idle) or filename (teasing.mp4, diego-aroused.webm). */
function emotionFromPart(fieldname: string, filename: string): MediaClipKey | null {
  const field = fieldname.toLowerCase().trim();
  if (isClipKey(field)) return field;

  const base = filename.toLowerCase().replace(/\.(mp4|webm)$/i, "");
  for (const key of CLIP_KEYS) {
    if (
      base === key ||
      base.endsWith(`-${key}`) ||
      base.endsWith(`_${key}`) ||
      base.startsWith(`${key}-`) ||
      base.startsWith(`${key}_`)
    ) {
      return key;
    }
  }
  for (const key of CLIP_KEYS) {
    if (base.includes(key)) return key;
  }
  return null;
}

async function drainPart(part: { toBuffer: () => Promise<Buffer> }) {
  await part.toBuffer().catch(() => Buffer.alloc(0));
}

export const createUploadRoutes = (): FastifyPluginAsync => {
  return async (app) => {
    await app.register(multipart, {
      limits: {
        fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 40 * 1024 * 1024),
        files: 8,
      },
    });

    app.post("/characters/custom/:characterId/clips/:emotion", async (request, reply) => {
      const { characterId, emotion } = request.params as {
        characterId: string;
        emotion: string;
      };

      if (!characterId.startsWith("custom-")) {
        return reply.code(400).send({ error: "Only custom characters accept uploads" });
      }
      if (!isClipKey(emotion)) {
        return reply
          .code(400)
          .send({ error: "emotion must be one of idle, teasing, playful, aroused" });
      }
      const access = await assertClipUploadAllowed(request, characterId);
      if (!access.ok) {
        return reply.code(access.status).send({ error: access.error, code: access.code });
      }

      const denied = await checkUploadLimits(request, characterId);
      if (denied) return rateLimited(reply, denied);

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "Expected multipart file field" });
      }

      const mime = file.mimetype ?? "";
      const declared = assertDeclaredClipMime(mime);
      if (declared) {
        await drainPart(file);
        return reply.code(400).send({
          error: declared.error,
          code: declared.code,
          allowed: ["video/mp4", "video/webm"],
        });
      }

      try {
        const buffer = await file.toBuffer();
        const saved = await saveCharacterClip({
          characterId,
          emotion,
          buffer,
          filename: file.filename || `${emotion}.mp4`,
          mimeType: mime,
        });

        const publicUrl = toPublicMediaUrl(saved.relativeUrl, requestPublicBase(request));
        const existing = getCustomCharacter(characterId)!;
        const mediaOverrides = {
          ...(existing.mediaOverrides ?? {}),
          [emotion]: publicUrl,
        };
        const updated = await updateCustomCharacter(
          characterId,
          { mediaOverrides },
          { accountId: access.accountId },
        );

        return {
          ok: true,
          characterId,
          emotion,
          url: publicUrl,
          bytes: saved.bytes,
          format: saved.format,
          contentType: saved.mime,
          mediaOverrides: updated.mediaOverrides,
          clips: listClipUrls(characterId),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        return reply.code(400).send({ error: message, code: "CLIP_REJECTED" });
      }
    });

    /**
     * Batch upload: multipart fields named idle/teasing/playful/aroused,
     * or filenames containing those tokens (e.g. teasing.mp4).
     */
    app.post("/characters/custom/:characterId/clips", async (request, reply) => {
      const { characterId } = request.params as { characterId: string };

      if (!characterId.startsWith("custom-")) {
        return reply.code(400).send({ error: "Only custom characters accept uploads" });
      }
      const access = await assertClipUploadAllowed(request, characterId);
      if (!access.ok) {
        return reply.code(access.status).send({ error: access.error, code: access.code });
      }

      const denied = await checkUploadLimits(request, characterId);
      if (denied) return rateLimited(reply, denied);

      const parts = request.files();
      const uploaded: Array<{
        emotion: MediaClipKey;
        url: string;
        bytes: number;
        filename: string;
        format: string;
        contentType: string;
      }> = [];
      const skipped: Array<{ filename: string; reason: string; code?: string }> = [];
      const overrides: MediaOverrides = {
        ...(getCustomCharacter(characterId)?.mediaOverrides ?? {}),
      };
      const base = requestPublicBase(request);

      try {
        for await (const part of parts) {
          const filename = part.filename || "clip.mp4";
          const emotion = emotionFromPart(part.fieldname, filename);
          if (!emotion) {
            skipped.push({
              filename,
              reason: "Could not detect emotion (name file idle/teasing/playful/aroused.mp4)",
              code: "BAD_EMOTION",
            });
            await drainPart(part);
            continue;
          }

          const mime = part.mimetype ?? "";
          const declared = assertDeclaredClipMime(mime);
          if (declared) {
            skipped.push({ filename, reason: declared.error, code: declared.code });
            await drainPart(part);
            continue;
          }

          try {
            const buffer = await part.toBuffer();
            const saved = await saveCharacterClip({
              characterId,
              emotion,
              buffer,
              filename,
              mimeType: mime,
            });
            const publicUrl = toPublicMediaUrl(saved.relativeUrl, base);
            overrides[emotion] = publicUrl;
            uploaded.push({
              emotion,
              url: publicUrl,
              bytes: saved.bytes,
              filename,
              format: saved.format,
              contentType: saved.mime,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed";
            skipped.push({ filename, reason: message, code: "CLIP_REJECTED" });
          }
        }

        if (uploaded.length === 0) {
          return reply.code(400).send({
            error: "No valid clips uploaded",
            skipped,
            hint: "Use .mp4 or .webm only; field names or filenames: idle, teasing, playful, aroused",
            allowed: ["video/mp4", "video/webm"],
          });
        }

        const updated = await updateCustomCharacter(
          characterId,
          { mediaOverrides: overrides },
          { accountId: access.accountId },
        );

        return {
          ok: true,
          characterId,
          uploaded,
          skipped,
          mediaOverrides: updated.mediaOverrides,
          clips: listClipUrls(characterId),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Batch upload failed";
        return reply.code(400).send({ error: message });
      }
    });
  };
};
