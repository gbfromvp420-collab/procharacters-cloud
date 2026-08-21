import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  isGenVideoConfigured,
  proxyGenVideoPerform,
} from "../lib/gen-video.js";
import { bump } from "../lib/observability/metrics.js";
import {
  RATE_LIMITS,
  clientIp,
  enforceRateLimits,
} from "../lib/rate-limit.js";

const performSchema = z.object({
  sessionId: z.string().min(1).max(128),
  characterId: z.string().min(1).max(128),
  message: z.string().min(1).max(4000),
});

export const createGenVideoRoutes = (): FastifyPluginAsync => {
  return async (app) => {
    app.get("/gen-video/status", async () => ({
      configured: isGenVideoConfigured(),
      default: "loops",
      optIn: true,
    }));

    app.post("/gen-video/perform", async (request, reply) => {
      const parsed = performSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          configured: isGenVideoConfigured(),
          error: "sessionId, characterId, and message are required",
        });
      }

      if (!isGenVideoConfigured()) {
        return reply.code(503).send({
          ok: false,
          configured: false,
          default: "loops",
          error: "Generative video is off — 4-loop clips stay the default",
        });
      }

      const denied = enforceRateLimits([
        {
          key: `gen-video:ip:${clientIp(request.headers)}`,
          limit: RATE_LIMITS.genVideoPerIp.limit,
          windowMs: RATE_LIMITS.genVideoPerIp.windowMs,
        },
      ]);
      if (denied) {
        return reply
          .code(429)
          .header("Retry-After", String(denied.retryAfterSec))
          .send({
            ok: false,
            configured: true,
            error: "Too many gen-video requests",
            retryAfterSec: denied.retryAfterSec,
          });
      }

      bump("genVideoRequests");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      try {
        const result = await proxyGenVideoPerform({
          ...parsed.data,
          signal: controller.signal,
        });
        if (!result.ok) bump("genVideoErrors");
        return reply.code(result.ok ? 200 : 502).send(result);
      } catch (err) {
        bump("genVideoErrors");
        const aborted = err instanceof Error && err.name === "AbortError";
        return reply.code(502).send({
          ok: false,
          configured: true,
          provider: null,
          videoUrl: null,
          jobId: null,
          durationMs: null,
          fallbackUsed: false,
          playable: false,
          error: aborted ? "gen-video timed out" : "gen-video proxy failed",
        });
      } finally {
        clearTimeout(timer);
      }
    });
  };
};
