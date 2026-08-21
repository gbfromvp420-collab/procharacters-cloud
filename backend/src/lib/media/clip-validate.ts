/**
 * Strict clip upload validation: MIME allowlist + extension + magic-byte sniff.
 * Rejects generic video/*, loose octet-stream without proof, and mime/ext mismatches.
 */

export type ClipFormat = "mp4" | "webm";

/** Exact Content-Types we accept (no bare video/*). */
export const ALLOWED_CLIP_MIMES = new Set([
  "video/mp4",
  "video/webm",
  // Browsers occasionally send these for MP4
  "video/x-m4v",
  "audio/mp4", // rare mislabel; still require ftyp magic
]);

/** Mimes that are only accepted if magic bytes prove the real format. */
export const PROVISIONAL_MIMES = new Set(["application/octet-stream", "binary/octet-stream", ""]);

const ALLOWED_EXT = new Set<ClipFormat>(["mp4", "webm"]);

export type ClipValidationOk = {
  ok: true;
  format: ClipFormat;
  mime: string;
  ext: ClipFormat;
};

export type ClipValidationErr = {
  ok: false;
  error: string;
  code:
    | "EMPTY"
    | "TOO_SMALL"
    | "TOO_LARGE"
    | "BAD_MIME"
    | "BAD_EXT"
    | "BAD_MAGIC"
    | "MIME_MISMATCH"
    | "EXT_MISMATCH";
};

export type ClipValidationResult = ClipValidationOk | ClipValidationErr;

function normalizeMime(raw?: string | null): string {
  if (!raw) return "";
  // strip parameters: "video/mp4; codecs=avc1"
  return raw.split(";")[0]?.trim().toLowerCase() ?? "";
}

function extFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

/** Detect container from file header (first ~32 bytes is enough). */
export function sniffClipFormat(buffer: Buffer): ClipFormat | null {
  if (buffer.byteLength < 12) return null;

  // WebM / Matroska EBML: 1A 45 DF A3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }

  // ISO BMFF (MP4/M4V/MOV): size(4) + "ftyp"
  if (
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70 // p
  ) {
    return "mp4";
  }

  // Some MP4s start with free/wide/mdat before ftyp within first 32–64 bytes
  const head = buffer.subarray(0, Math.min(buffer.byteLength, 64)).toString("latin1");
  if (head.includes("ftyp")) return "mp4";

  return null;
}

function mimeImpliesFormat(mime: string): ClipFormat | null {
  if (mime === "video/webm") return "webm";
  if (mime === "video/mp4" || mime === "video/x-m4v" || mime === "audio/mp4") return "mp4";
  return null;
}

/**
 * Full validation for a clip buffer + declared metadata.
 * Call after reading the multipart body into memory.
 */
export function validateClipUpload(options: {
  buffer: Buffer;
  filename: string;
  mimeType?: string | null;
  maxBytes?: number;
  minBytes?: number;
}): ClipValidationResult {
  const maxBytes = options.maxBytes ?? Number(process.env.MAX_UPLOAD_BYTES ?? 40 * 1024 * 1024);
  const minBytes = options.minBytes ?? 1024;
  const mime = normalizeMime(options.mimeType);
  const ext = extFromFilename(options.filename);
  const buf = options.buffer;

  if (!buf || buf.byteLength === 0) {
    return { ok: false, error: "Empty upload", code: "EMPTY" };
  }
  if (buf.byteLength < minBytes) {
    return {
      ok: false,
      error: "File too small to be a video clip",
      code: "TOO_SMALL",
    };
  }
  if (buf.byteLength > maxBytes) {
    return {
      ok: false,
      error: `File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`,
      code: "TOO_LARGE",
    };
  }

  // Reject obviously non-video declared types early (no video/* free-for-all)
  if (mime && !ALLOWED_CLIP_MIMES.has(mime) && !PROVISIONAL_MIMES.has(mime)) {
    // Catch video/avi, video/quicktime-as-wrong, image/*, text/*, etc.
    return {
      ok: false,
      error: `Unsupported content-type "${mime}". Use video/mp4 or video/webm.`,
      code: "BAD_MIME",
    };
  }

  if (ext && !ALLOWED_EXT.has(ext as ClipFormat)) {
    return {
      ok: false,
      error: `Unsupported extension ".${ext}". Only .mp4 and .webm are allowed.`,
      code: "BAD_EXT",
    };
  }

  const sniffed = sniffClipFormat(buf);
  if (!sniffed) {
    return {
      ok: false,
      error:
        "File content is not a recognized MP4 or WebM (magic bytes). Re-export as H.264 MP4 or VP8/VP9 WebM.",
      code: "BAD_MAGIC",
    };
  }

  const implied = mimeImpliesFormat(mime);
  if (implied && implied !== sniffed) {
    return {
      ok: false,
      error: `Content-type claims ${implied} but file is ${sniffed}`,
      code: "MIME_MISMATCH",
    };
  }

  if (ext && ext !== sniffed) {
    return {
      ok: false,
      error: `Filename ends in .${ext} but file content is ${sniffed}`,
      code: "EXT_MISMATCH",
    };
  }

  // Canonical mime for storage
  const canonicalMime = sniffed === "webm" ? "video/webm" : "video/mp4";

  return {
    ok: true,
    format: sniffed,
    mime: canonicalMime,
    ext: sniffed,
  };
}

/** Cheap pre-check before buffering (rejects bad Content-Type headers early). */
export function assertDeclaredClipMime(mimeType?: string | null): ClipValidationErr | null {
  const mime = normalizeMime(mimeType);
  if (!mime || PROVISIONAL_MIMES.has(mime)) return null; // defer to magic bytes
  if (ALLOWED_CLIP_MIMES.has(mime)) return null;
  return {
    ok: false,
    error: `Unsupported content-type "${mime}". Use video/mp4 or video/webm.`,
    code: "BAD_MIME",
  };
}
