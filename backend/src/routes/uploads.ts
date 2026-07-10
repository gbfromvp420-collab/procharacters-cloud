import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../config/env.js";
import { getCustomCharacter, updateCustomCharacter } from "../lib/live/index.js";
import { listClipUrls } from "../lib/media/clip-resolver.js";
import {
  isClipKey,
  saveCharacterClip,
  toPublicMediaUrl,
} from "../lib/media/upload-store.js";

export const createUploadRoutes = (): FastifyPluginAsync => {
  return async (app) => {
    await app.register(multipart, {
      limits: {
        fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 40 * 1024 * 1024),
        files: 1,
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

        const forwardedProto = request.headers["x-forwarded-proto"];
        const proto =
          typeof forwardedProto === "string"
            ? forwardedProto.split(",")[0]?.trim()
            : env.PUBLIC_API_URL?.startsWith("https")
              ? "https"
              : "http";
        const requestBase =
          env.PUBLIC_API_URL?.replace(/\/$/, "") ||
          `${proto}://${request.headers.host ?? "localhost:3001"}`;
        const publicUrl = toPublicMediaUrl(saved.relativeUrl, requestBase);
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
  };
};
