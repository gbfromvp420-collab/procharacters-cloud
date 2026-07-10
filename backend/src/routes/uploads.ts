import multipart from "@fastify/multipart";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import type { MediaClipKey, MediaOverrides } from "../lib/live/custom-characters.js";
import { getCustomCharacter, updateCustomCharacter } from "../lib/live/index.js";
import { listClipUrls } from "../lib/media/clip-resolver.js";
import {
  isClipKey,
  saveCharacterClip,
  toPublicMediaUrl,
} from "../lib/media/upload-store.js";

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
    if (base === key || base.endsWith(`-${key}`) || base.endsWith(`_${key}`) || base.includes(key)) {
      // Prefer exact / suffix matches over loose includes
      if (base === key || base.endsWith(`-${key}`) || base.endsWith(`_${key}`) || base.startsWith(`${key}-`) || base.startsWith(`${key}_`)) {
        return key;
      }
    }
  }
  // Loose fallback: filename contains the emotion token
  for (const key of CLIP_KEYS) {
    if (base.includes(key)) return key;
  }
  return null;
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
      if (!getCustomCharacter(characterId)) {
        return reply.code(404).send({ error: "Custom character not found" });
      }

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "Expected multipart file field" });
      }

      const mime = file.mimetype ?? "";
      if (!mime.startsWith("video/") && mime !== "application/octet-stream") {
        return reply.code(400).send({ error: "Upload must be a video file (mp4/webm)" });
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
        const updated = await updateCustomCharacter(characterId, { mediaOverrides });

        return {
          ok: true,
          characterId,
          emotion,
          url: publicUrl,
          bytes: saved.bytes,
          mediaOverrides: updated.mediaOverrides,
          clips: listClipUrls(characterId),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        return reply.code(400).send({ error: message });
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
      if (!getCustomCharacter(characterId)) {
        return reply.code(404).send({ error: "Custom character not found" });
      }

      const parts = request.files();
      const uploaded: Array<{ emotion: MediaClipKey; url: string; bytes: number; filename: string }> =
        [];
      const skipped: Array<{ filename: string; reason: string }> = [];
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
            });
            // Drain
            await part.toBuffer().catch(() => Buffer.alloc(0));
            continue;
          }

          const mime = part.mimetype ?? "";
          if (!mime.startsWith("video/") && mime !== "application/octet-stream") {
            skipped.push({ filename, reason: "Not a video file" });
            await part.toBuffer().catch(() => Buffer.alloc(0));
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
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed";
            skipped.push({ filename, reason: message });
          }
        }

        if (uploaded.length === 0) {
          return reply.code(400).send({
            error: "No valid clips uploaded",
            skipped,
            hint: "Use field names or filenames: idle, teasing, playful, aroused",
          });
        }

        const updated = await updateCustomCharacter(characterId, {
          mediaOverrides: overrides,
        });

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
