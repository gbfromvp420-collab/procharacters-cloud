/** Client-side clip validation before hitting the API. */

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/x-m4v",
  "application/octet-stream",
  "",
]);

const ALLOWED_EXT = new Set(["mp4", "webm"]);

export type ClipFileCheck =
  | { ok: true }
  | { ok: false; error: string };

function extOf(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const i = base.lastIndexOf(".");
  return i < 0 ? "" : base.slice(i + 1).toLowerCase();
}

export function validateClipFileClient(file: File): ClipFileCheck {
  const mime = (file.type || "").split(";")[0].trim().toLowerCase();
  const ext = extOf(file.name);

  if (file.size < 1024) {
    return { ok: false, error: `${file.name}: file too small` };
  }
  if (file.size > 40 * 1024 * 1024) {
    return { ok: false, error: `${file.name}: max 40MB` };
  }

  if (mime && !ALLOWED_TYPES.has(mime) && !mime.startsWith("video/mp4") && mime !== "video/webm") {
    // Reject video/avi, image/*, etc. before upload
    if (!mime.startsWith("video/") || (mime !== "video/mp4" && mime !== "video/webm" && mime !== "video/x-m4v")) {
      return {
        ok: false,
        error: `${file.name}: unsupported type "${mime || "unknown"}" — use MP4 or WebM`,
      };
    }
  }

  if (ext && !ALLOWED_EXT.has(ext)) {
    return {
      ok: false,
      error: `${file.name}: only .mp4 and .webm allowed`,
    };
  }

  if (!ext && mime !== "video/mp4" && mime !== "video/webm") {
    return {
      ok: false,
      error: `${file.name}: add a .mp4 or .webm extension`,
    };
  }

  return { ok: true };
}

export function filterValidClipFiles(files: File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of files) {
    const check = validateClipFileClient(file);
    if (check.ok) accepted.push(file);
    else rejected.push({ name: file.name, reason: check.error });
  }
  return { accepted, rejected };
}

/** accept= attribute for <input type="file"> */
export const CLIP_FILE_ACCEPT = "video/mp4,video/webm,video/x-m4v,.mp4,.webm";
