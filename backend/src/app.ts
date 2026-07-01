import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { LiveKitService } from "./lib/livekit/service.js";
import { createHealthRoutes } from "./routes/health.js";
import { createLiveCamRoutes } from "./routes/livecam.js";
import { createMediaRoutes } from "./routes/media.js";
import { createSessionRoutes } from "./routes/sessions.js";
import { createTokenRoutes } from "./routes/tokens.js";
import { ChatOrchestrator } from "./services/chat-orchestrator.js";
import { LiveCamService } from "./services/livecam-service.js";
import { MediaGenerationService } from "./services/media-generation-service.js";
import { MediaWorker } from "./services/media-worker.js";
import { MemoryManager } from "./services/memory-manager.js";
import { SessionManager } from "./services/session-manager.js";
import { TokenService } from "./services/token-service.js";
import { createWebSocketHandler } from "./ws/handler.js";

export async function buildApp() {
  const app = Fastify({
    logger: env.isDev,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN ?? true,
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false, // handled by frontend
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
  await app.register(websocket);

  /* ── Core services (v2 MVP) ─────────────────────────── */

  const avatarMemory = new MemoryManager();
  const sessionManager = new SessionManager(
    avatarMemory,
    env.DEFAULT_CHARACTER_ID,
    env.SESSION_TTL_MINUTES,
    env.MAX_MESSAGE_WINDOW,
  );
  const chat = new ChatOrchestrator(sessionManager, avatarMemory, {
    maxMessageWindow: env.MAX_MESSAGE_WINDOW,
    xaiApiKey: env.XAI_API_KEY,
    xaiModel: env.XAI_MODEL,
    xaiBaseUrl: env.XAI_BASE_URL,
    xaiMaxCompletionTokens: env.XAI_MAX_COMPLETION_TOKENS,
    xaiTemperature: env.XAI_TEMPERATURE,
  });

  const livekit = new LiveKitService(
    env.livekitConfigured
      ? {
          url: env.LIVEKIT_URL!,
          apiKey: env.LIVEKIT_API_KEY!,
          apiSecret: env.LIVEKIT_API_SECRET!,
        }
      : null,
  );
  const media = new MediaWorker(livekit);

  /* ── New services (Feature A + B) ───────────────────── */

  const tokenService = new TokenService();
  const liveCam = new LiveCamService(tokenService);
  const mediaGen = new MediaGenerationService({
    provider: env.MEDIA_PROVIDER as "placeholder" | "generic" | "internal" | "flux" | "sdxl",
    apiKey: env.MEDIA_API_KEY,
    baseUrl: env.MEDIA_BASE_URL,
    modelId: env.MEDIA_MODEL_ID,
    concurrency: env.MEDIA_CONCURRENCY,
    width: env.MEDIA_WIDTH,
    height: env.MEDIA_HEIGHT,
    videoDurationSeconds: env.MEDIA_VIDEO_DURATION,
    sampler: env.MEDIA_SAMPLER,
    steps: env.MEDIA_STEPS,
    cfgScale: env.MEDIA_CFG_SCALE,
  });

  /* ── Logging ────────────────────────────────────────── */

  if (!env.XAI_API_KEY) {
    app.log.warn("XAI_API_KEY not set — chat will use stub replies until configured");
  } else {
    app.log.info({ model: env.XAI_MODEL }, "Grok/xAI chat enabled");
  }

  if (livekit.isConfigured) {
    app.log.info({ url: livekit.serverUrl }, "LiveKit room metadata sync enabled");
  } else {
    app.log.warn("LiveKit not configured — video uses WebSocket mediaUrl only");
  }

  app.log.info({ provider: mediaGen.providerName }, "Media generation provider active");

  /* ── Routes ─────────────────────────────────────────── */

  await app.register(createHealthRoutes(livekit));

  // v2 MVP routes
  await app.register(createSessionRoutes(sessionManager, media, livekit), {
    prefix: "/api/v1",
  });

  // Feature A + B routes
  await app.register(createTokenRoutes(tokenService), { prefix: "/api/v1" });
  await app.register(createLiveCamRoutes(liveCam), { prefix: "/api/v1" });
  await app.register(createMediaRoutes(mediaGen, tokenService), { prefix: "/api/v1" });

  /* ── WebSocket ──────────────────────────────────────── */

  app.get("/ws/sessions/:sessionId", { websocket: true }, (socket, request) => {
    void createWebSocketHandler(sessionManager, chat, media)(socket, request);
  });

  /* ── Global error handler ──────────────────────────── */

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = reply.statusCode >= 400 ? reply.statusCode : 500;
    const err = error as Record<string, unknown>;
    const code = typeof err["statusCode"] === "number" ? err["statusCode"] : statusCode;
    const message = error instanceof Error ? error.message : "Unknown error";

    if (code === 429) {
      return reply.status(429).send({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please slow down.",
      });
    }

    const isInternal = code >= 500;

    if (isInternal) {
      app.log.error(error);
    }

    return reply.status(code).send({
      error: isInternal ? "Internal Server Error" : message,
    });
  });

  /* ── 404 handler ───────────────────────────────────── */

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: "Not Found" });
  });

  return app;
}