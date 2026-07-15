/** URL helpers for shareable character deep-links. */

export interface ShareQuery {
  characterId?: string;
  autostart?: boolean;
  /** Preferred: short resume code (no raw token). */
  resumeCode?: string;
  /** Email magic-link token from ?magic= */
  magicToken?: string;
  /** Legacy private resume credentials. */
  sessionId?: string;
  token?: string;
  /** Phase 10: normal | edge_pace */
  sessionMode?: "normal" | "edge_pace";
}

export function parseShareQuery(search: string): ShareQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const characterId = params.get("character")?.trim() || undefined;
  const resumeCode = params.get("resume")?.trim() || undefined;
  const magicToken = params.get("magic")?.trim() || undefined;
  const sessionId = params.get("session")?.trim() || undefined;
  const token = params.get("token")?.trim() || undefined;
  const modeRaw = params.get("mode")?.trim().toLowerCase();
  const sessionMode =
    modeRaw === "edge_pace" || modeRaw === "edge" || modeRaw === "pace"
      ? "edge_pace"
      : modeRaw === "normal"
        ? "normal"
        : undefined;
  const autostartRaw = params.get("autostart")?.trim().toLowerCase();
  const autostart =
    autostartRaw === "1" ||
    autostartRaw === "true" ||
    autostartRaw === "yes" ||
    !!resumeCode ||
    (!!sessionId && !!token);

  return { characterId, autostart, resumeCode, magicToken, sessionId, token, sessionMode };
}

/** Pretty public character card (preferred for sharing). */
export function buildCharacterCardUrl(
  characterId: string,
  options: { origin?: string } = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://procharacters-web-production-7288.up.railway.app");
  return `${origin.replace(/\/$/, "")}/character/${encodeURIComponent(characterId)}`;
}

export function buildCharacterShareUrl(
  characterId: string,
  options: {
    origin?: string;
    autostart?: boolean;
    card?: boolean;
    sessionMode?: "normal" | "edge_pace";
  } = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://procharacters-web-production-7288.up.railway.app");

  // Default public share is the pretty card page.
  if (options.card !== false && !options.autostart) {
    return buildCharacterCardUrl(characterId, { origin });
  }

  // Autostart / deep-links land on the live chat app route.
  const url = new URL(`${origin.replace(/\/$/, "")}/chat`);
  url.searchParams.set("character", characterId);
  if (options.autostart) {
    url.searchParams.set("autostart", "1");
  }
  if (options.sessionMode === "edge_pace") {
    url.searchParams.set("mode", "edge_pace");
  }
  return url.toString();
}

/** Preferred private resume link — short code only (no raw ws token). */
export function buildResumeCodeShareUrl(
  resumeCode: string,
  options: { origin?: string; characterId?: string } = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://procharacters-web-production-7288.up.railway.app");
  const url = new URL(`${origin.replace(/\/$/, "")}/chat`);
  url.searchParams.set("resume", resumeCode.toUpperCase());
  if (options.characterId) {
    url.searchParams.set("character", options.characterId);
  }
  return url.toString();
}

/** @deprecated Prefer buildResumeCodeShareUrl — keeps raw tokens out of URLs. */
export function buildResumeShareUrl(
  sessionId: string,
  token: string,
  options: { origin?: string; characterId?: string } = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://procharacters-web-production-7288.up.railway.app");
  const url = new URL(origin);
  url.searchParams.set("session", sessionId);
  url.searchParams.set("token", token);
  if (options.characterId) {
    url.searchParams.set("character", options.characterId);
  }
  return url.toString();
}

/** Keep the address bar in sync without a full navigation. */
export function replaceCharacterInUrl(characterId: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (characterId) {
    url.searchParams.set("character", characterId);
  } else {
    url.searchParams.delete("character");
  }
  // Never leave private tokens / resume codes / one-shot mode flags in the bar after boot
  url.searchParams.delete("session");
  url.searchParams.delete("token");
  url.searchParams.delete("resume");
  url.searchParams.delete("magic");
  url.searchParams.delete("autostart");
  url.searchParams.delete("mode");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** True when the browser exposes the Web Share API (typical mobile). */
export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export type ShareOrCopyResult =
  | { ok: true; method: "share" | "copy" }
  | { ok: false; reason: "cancelled" | "failed" };

/**
 * Prefer native share sheet (mobile); fall back to clipboard copy.
 * Tries a .md File first when the OS supports file share, else text.
 */
export async function shareOrCopyText(options: {
  title?: string;
  text: string;
  filename?: string;
}): Promise<ShareOrCopyResult> {
  const title = options.title ?? "Procharacters transcript";
  const text = options.text;
  const filename = options.filename ?? "procharacters-transcript.md";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      // File share (iOS/Android often maps to Files / Notes / Messages)
      if (typeof File !== "undefined") {
        const file = new File([text.endsWith("\n") ? text : `${text}\n`], filename, {
          type: "text/markdown",
        });
        const filePayload = { title, files: [file] as File[] };
        if (
          typeof navigator.canShare !== "function" ||
          navigator.canShare(filePayload)
        ) {
          await navigator.share(filePayload);
          return { ok: true, method: "share" };
        }
      }

      const textPayload = { title, text };
      if (
        typeof navigator.canShare !== "function" ||
        navigator.canShare(textPayload)
      ) {
        await navigator.share(textPayload);
        return { ok: true, method: "share" };
      }
    } catch (err) {
      // User dismissed the sheet — not an error for the UI
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, reason: "cancelled" };
      }
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, reason: "cancelled" };
      }
      // Fall through to clipboard
    }
  }

  const copied = await copyText(text);
  return copied ? { ok: true, method: "copy" } : { ok: false, reason: "failed" };
}

/** Human flash for shareOrCopyText results. */
export function shareResultLabel(
  result: ShareOrCopyResult,
  kind = "Transcript",
): string | null {
  if (!result.ok) {
    if (result.reason === "cancelled") return null;
    return "Share failed";
  }
  if (result.method === "share") return `${kind} opened in share sheet`;
  return `${kind} copied (Markdown)`;
}

/**
 * Share a URL via the system share sheet when available (mobile).
 * Falls back to copying the URL. Prefer this for character cards / links.
 */
export async function shareOrCopyUrl(options: {
  url: string;
  title?: string;
  text?: string;
}): Promise<ShareOrCopyResult> {
  const title = options.title ?? "Procharacters";
  const url = options.url;
  const text = options.text ?? title;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      // Prefer url field when supported (iOS Messages, etc.)
      const withUrl = { title, text, url };
      if (typeof navigator.canShare !== "function" || navigator.canShare(withUrl)) {
        await navigator.share(withUrl);
        return { ok: true, method: "share" };
      }
      // Some browsers only accept text
      const textOnly = { title, text: `${text}\n${url}` };
      if (typeof navigator.canShare !== "function" || navigator.canShare(textOnly)) {
        await navigator.share(textOnly);
        return { ok: true, method: "share" };
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, reason: "cancelled" };
      }
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, reason: "cancelled" };
      }
      // Fall through to clipboard
    }
  }

  const copied = await copyText(url);
  return copied ? { ok: true, method: "copy" } : { ok: false, reason: "failed" };
}

export function shareUrlResultLabel(
  result: ShareOrCopyResult,
  kind = "Link",
): string | null {
  if (!result.ok) {
    if (result.reason === "cancelled") return null;
    return "Share failed";
  }
  if (result.method === "share") return `${kind} opened in share sheet`;
  return `${kind} copied`;
}
