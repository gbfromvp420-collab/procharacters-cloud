/** URL helpers for shareable character deep-links. */

export interface ShareQuery {
  characterId?: string;
  autostart?: boolean;
  /** Preferred: short resume code (no raw token). */
  resumeCode?: string;
  /** Legacy private resume credentials. */
  sessionId?: string;
  token?: string;
}

export function parseShareQuery(search: string): ShareQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const characterId = params.get("character")?.trim() || undefined;
  const resumeCode = params.get("resume")?.trim() || undefined;
  const sessionId = params.get("session")?.trim() || undefined;
  const token = params.get("token")?.trim() || undefined;
  const autostartRaw = params.get("autostart")?.trim().toLowerCase();
  const autostart =
    autostartRaw === "1" ||
    autostartRaw === "true" ||
    autostartRaw === "yes" ||
    !!resumeCode ||
    (!!sessionId && !!token);

  return { characterId, autostart, resumeCode, sessionId, token };
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
  options: { origin?: string; autostart?: boolean; card?: boolean } = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://procharacters-web-production-7288.up.railway.app");

  // Default public share is the pretty card page.
  if (options.card !== false && !options.autostart) {
    return buildCharacterCardUrl(characterId, { origin });
  }

  const url = new URL(origin);
  url.searchParams.set("character", characterId);
  if (options.autostart) {
    url.searchParams.set("autostart", "1");
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
  const url = new URL(origin);
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
  // Never leave private tokens / resume codes in the bar after boot
  url.searchParams.delete("session");
  url.searchParams.delete("token");
  url.searchParams.delete("resume");
  url.searchParams.delete("autostart");
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
