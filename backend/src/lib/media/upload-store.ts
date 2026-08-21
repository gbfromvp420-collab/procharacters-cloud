import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoPath } from "../paths.js";
import type { MediaClipKey } from "../live/custom-characters.js";
import { type ClipFormat, validateClipUpload } from "./clip-validate.js";

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

/** @deprecated prefer validateClipUpload — kept for callers that only need ext guess */
export function extensionFromFilename(filename: string, mimeType?: string): ClipFormat {
  const fromName = filename.split(".").pop()?.toLowerCase() ?? "";
  if (fromName === "mp4" || fromName === "webm") return fromName;
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/mp4" || mimeType === "video/x-m4v") return "mp4";
  return "mp4";
}

export async function saveCharacterClip(options: {
  characterId: string;
  emotion: MediaClipKey;
  buffer: Buffer;
  filename: string;
  mimeType?: string;
}): Promise<{
  relativeUrl: string;
  absolutePath: string;
  bytes: number;
  format: ClipFormat;
  mime: string;
}> {
  const safeId = options.characterId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId || safeId !== options.characterId) {
    throw new Error("Invalid character id for upload");
  }
  if (!isClipKey(options.emotion)) {
    throw new Error("Invalid clip emotion");
  }

  const validated = validateClipUpload({
    buffer: options.buffer,
    filename: options.filename,
    mimeType: options.mimeType,
  });
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const dir = join(resolveUploadsDir(), safeId);
  await mkdir(dir, { recursive: true });
  // Always write with sniffed extension so players get correct type
  const absolutePath = join(dir, `${options.emotion}.${validated.ext}`);
  await writeFile(absolutePath, options.buffer);

  return {
    relativeUrl: `/media/uploads/${safeId}/${options.emotion}.${validated.ext}`,
    absolutePath,
    bytes: options.buffer.byteLength,
    format: validated.format,
    mime: validated.mime,
  };
}

export function toPublicMediaUrl(relativeUrl: string, publicApiUrl?: string): string {
  if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;
  const base = (publicApiUrl ?? "").replace(/\/$/, "");
  if (!base) return relativeUrl;
  return `${base}${relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`}`;
}
