/** URL helpers for shareable character deep-links. */

export interface ShareQuery {
  characterId?: string;
  autostart?: boolean;
  /** Private resume credentials (treat like a password). */
  sessionId?: string;
  token?: string;
}

export function parseShareQuery(search: string): ShareQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const characterId = params.get("character")?.trim() || undefined;
  const sessionId = params.get("session")?.trim() || undefined;
  const token = params.get("token")?.trim() || undefined;
  const autostartRaw = params.get("autostart")?.trim().toLowerCase();
  const autostart =
    autostartRaw === "1" ||
    autostartRaw === "true" ||
    autostartRaw === "yes" ||
    // session+token implies resume autostart
    (!!sessionId && !!token);

  return { characterId, autostart, sessionId, token };
}

export function buildCharacterShareUrl(
  characterId: string,
  options: { origin?: string; autostart?: boolean } = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://procharacters-web-production-7288.up.railway.app");
  const url = new URL(origin);
  url.searchParams.set("character", characterId);
  if (options.autostart) {
    url.searchParams.set("autostart", "1");
  }
  return url.toString();
}

/** Private multi-device resume link — anyone with this can rejoin the transcript. */
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
  // Never leave private tokens in the bar after load
  url.searchParams.delete("session");
  url.searchParams.delete("token");
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
