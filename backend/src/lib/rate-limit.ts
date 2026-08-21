/**
 * Simple sliding-window rate limiter (in-process).
 * Fine for single Railway replica; resets on restart.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
}

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

function prune(hits: number[], windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  return hits.filter((t) => t > cutoff);
}

/**
 * @param key unique key e.g. `magic:ip:1.2.3.4` or `upload:char:id`
 * @param limit max hits in window
 * @param windowMs window length
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = prune(bucket.hits, windowMs, now);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      limit,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.hits.length),
    retryAfterSec: 0,
    limit,
  };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim() || "unknown";
  }
  const realIp = headers["x-real-ip"];
  if (typeof realIp === "string" && realIp) return realIp.trim();
  return "unknown";
}

// Defaults — override with env
export const RATE_LIMITS = {
  magicPerIp: {
    limit: Number(process.env.RATE_LIMIT_MAGIC_IP ?? 8),
    windowMs: Number(process.env.RATE_LIMIT_MAGIC_IP_WINDOW_MS ?? 15 * 60 * 1000),
  },
  magicPerEmail: {
    limit: Number(process.env.RATE_LIMIT_MAGIC_EMAIL ?? 4),
    windowMs: Number(process.env.RATE_LIMIT_MAGIC_EMAIL_WINDOW_MS ?? 15 * 60 * 1000),
  },
  authPerIp: {
    limit: Number(process.env.RATE_LIMIT_AUTH_IP ?? 30),
    windowMs: Number(process.env.RATE_LIMIT_AUTH_IP_WINDOW_MS ?? 15 * 60 * 1000),
  },
  uploadPerIp: {
    limit: Number(process.env.RATE_LIMIT_UPLOAD_IP ?? 40),
    windowMs: Number(process.env.RATE_LIMIT_UPLOAD_IP_WINDOW_MS ?? 60 * 60 * 1000),
  },
  uploadPerCharacter: {
    limit: Number(process.env.RATE_LIMIT_UPLOAD_CHAR ?? 20),
    windowMs: Number(process.env.RATE_LIMIT_UPLOAD_CHAR_WINDOW_MS ?? 60 * 60 * 1000),
  },
  importPerIp: {
    limit: Number(process.env.RATE_LIMIT_IMPORT_IP ?? 20),
    windowMs: Number(process.env.RATE_LIMIT_IMPORT_IP_WINDOW_MS ?? 60 * 60 * 1000),
  },
  resumeEmailPerAccount: {
    limit: Number(process.env.RATE_LIMIT_RESUME_EMAIL ?? 5),
    windowMs: Number(process.env.RATE_LIMIT_RESUME_EMAIL_WINDOW_MS ?? 60 * 60 * 1000),
  },
  /** Test push spam guard — per account */
  pushTestPerAccount: {
    limit: Number(process.env.RATE_LIMIT_PUSH_TEST ?? 6),
    windowMs: Number(process.env.RATE_LIMIT_PUSH_TEST_WINDOW_MS ?? 15 * 60 * 1000),
  },
  pushTestPerIp: {
    limit: Number(process.env.RATE_LIMIT_PUSH_TEST_IP ?? 12),
    windowMs: Number(process.env.RATE_LIMIT_PUSH_TEST_IP_WINDOW_MS ?? 15 * 60 * 1000),
  },
  /** Opt-in gen-video proxy — GPU / mock cost guard */
  genVideoPerIp: {
    limit: Number(process.env.RATE_LIMIT_GEN_VIDEO_IP ?? 20),
    windowMs: Number(process.env.RATE_LIMIT_GEN_VIDEO_IP_WINDOW_MS ?? 15 * 60 * 1000),
  },
  /** Studio Forge expand — LLM cost guard */
  forgeExpand: {
    limit: Number(process.env.RATE_LIMIT_FORGE_EXPAND ?? 30),
    windowMs: Number(process.env.RATE_LIMIT_FORGE_EXPAND_WINDOW_MS ?? 15 * 60 * 1000),
  },
};

/** Apply multiple limiters; returns first denial or null if all pass. */
export function enforceRateLimits(
  checks: Array<{ key: string; limit: number; windowMs: number }>,
): RateLimitResult | null {
  for (const check of checks) {
    const result = checkRateLimit(check.key, check.limit, check.windowMs);
    if (!result.allowed) return result;
  }
  return null;
}
