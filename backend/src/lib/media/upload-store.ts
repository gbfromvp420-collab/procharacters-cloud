import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoPath } from "../paths.js";
import type { MediaClipKey } from "../live/custom-characters.js";

const ALLOWED_EXT = new Set(["mp4", "webm"]);

export function resolveUploadsDir(): string {
  if (process.env.UPLOADS_PATH?.trim()) return process.env.UPLOADS_PATH.trim();
  if (process.env.CUSTOM_CHARACTERS_PATH?.startsWith("/data")) {
    return "/data/uploads";
  }
  return repoPath("data", "uploads");
}

export function isClipKey(value: string): value is MediaClipKey {
  return value === "idle" || value === "teasing" || value === "playful" || value === "aroused";
}

export function extensionFromFilename(filename: string, mimeType?: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXT.has(fromName)) return fromName;
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/mp4") return "mp4";
  return "mp4";
}

export async function saveCharacterClip(options: {
  characterId: string;
  emotion: MediaClipKey;
  buffer: Buffer;
  filename: string;
  mimeType?: string;
}): Promise<{ relativeUrl: string; absolutePath: string; bytes: number }> {
  const safeId = options.characterId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId || safeId !== options.characterId) {
    throw new Error("Invalid character id for upload");
  }
  if (!isClipKey(options.emotion)) {
    throw new Error("Invalid clip emotion");
  }

  const ext = extensionFromFilename(options.filename, options.mimeType);
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("Only .mp4 and .webm uploads are supported");
  }

  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 40 * 1024 * 1024);
  if (options.buffer.byteLength > maxBytes) {
    throw new Error(`File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`);
  }
  if (options.buffer.byteLength < 1024) {
    throw new Error("File too small to be a video");
  }

  const dir = join(resolveUploadsDir(), safeId);
  await mkdir(dir, { recursive: true });
  const absolutePath = join(dir, `${options.emotion}.${ext}`);
  await writeFile(absolutePath, options.buffer);

  return {
    relativeUrl: `/media/uploads/${safeId}/${options.emotion}.${ext}`,
    absolutePath,
    bytes: options.buffer.byteLength,
  };
}

export function toPublicMediaUrl(relativeUrl: string, publicApiUrl?: string): string {
  if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;
  const base = (publicApiUrl ?? "").replace(/\/$/, "");
  if (!base) return relativeUrl;
  return `${base}${relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`}`;
}
