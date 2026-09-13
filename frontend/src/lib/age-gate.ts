/** Client age-gate persistence — cookie + localStorage, 30-day TTL. */

export const AGE_GATE_STORAGE_KEY = "pc_age_verified_21";
export const AGE_GATE_COOKIE = "pc_age_verified_21";
export const AGE_GATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isAgeVerifiedTimestamp(raw: string | null | undefined, now = Date.now()): boolean {
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return now - ts < AGE_GATE_TTL_MS;
}

export function readAgeCookie(cookieHeader: string | undefined, name = AGE_GATE_COOKIE): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function buildAgeVerifiedCookie(now = Date.now()): string {
  const maxAge = Math.floor(AGE_GATE_TTL_MS / 1000);
  return `${AGE_GATE_COOKIE}=${now}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export function clearAgeVerifiedCookie(): string {
  return `${AGE_GATE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function isAgeVerifiedFromSources(opts: {
  localStorageValue?: string | null;
  cookieHeader?: string;
  now?: number;
}): boolean {
  const now = opts.now ?? Date.now();
  return (
    isAgeVerifiedTimestamp(opts.localStorageValue, now) ||
    isAgeVerifiedTimestamp(readAgeCookie(opts.cookieHeader), now)
  );
}
