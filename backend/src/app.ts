import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { env } from "./config/env.js";
import { initAccountStore } from "./lib/accounts/account-store.js";
import { initCustomCharacters } from "./lib/live/index.js";
import { resolveUploadsDir } from "./lib/media/upload-store.js";
import { initSessionStore, pruneOldSessions } from "./lib/memory/session-store.js";
import { LiveKitService } from "./lib/livekit/service.js";
import { startResumeExpiryPushCron } from "./lib/push/expiry-notify.js";
import { initPushStore } from "./lib/push/push-store.js";
import { isWebPushConfigured } from "./lib/push/web-push-service.js";
import { createAccountRoutes } from "./routes/accounts.js";
import { createBillingRoutes } from "./routes/billing.js";
import { createHealthRoutes } from "./routes/health.js";
import { createGenVideoRoutes } from "./routes/gen-video.js";
import { createPushRoutes } from "./routes/push.js";
import { createSessionRoutes } from "./routes/sessions.js";
import { createUploadRoutes } from "./routes/uploads.js";
import { ChatOrchestrator } from "./services/chat-orchestrator.js";
import { MediaWorker } from "./services/media-worker.js";
import { MemoryManager } from "./services/memory-manager.js";
import { SessionManager } from "./services/session-manager.js";
import { createWebSocketHandler } from "./ws/handler.js";

export async function buildApp() {
  const app = Fastify({
    // Structured JSON logs (pino). Disable default req spam — custom hooks log paths only.
    logger: {
      level: process.env.LOG_LEVEL?.trim() || "info",
    },
    trustProxy: true,
    disableRequestLogging: true,
    bodyLimit: Number(process.env.MAX_UPLOAD_BYTES ?? 45 * 1024 * 1024),
    genReqId: (req) => {
      const h = req.headers["x-request-id"];
      if (typeof h === "string" && h.trim()) return h.trim().slice(0, 64);
      return randomUUID();
    },
  });

  const { registerObservability } = await import("./lib/observability/request-logs.js");
  registerObservability(app);

  // Preserve raw body for Stripe webhooks (signature verification)
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      try {
        (req as { rawBody?: Buffer }).rawBody = body as Buffer;
        const text = (body as Buffer).toString("utf8");
        done(null, text ? JSON.parse(text) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(cors, { origin: true });
  await app.register(websocket);

  const uploadsDir = resolveUploadsDir();
  await mkdir(uploadsDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/media/uploads/",
    decorateReply: false,
  });
  app.log.info({ uploadsDir }, "Clip uploads directory ready");

  const customStore = await initCustomCharacters(
    env.CUSTOM_CHARACTERS_PATH?.trim() || undefined,
  );
  app.log.info(
    { path: customStore.path, count: customStore.count },
    "Custom characters store ready",
  );

  const sessionStore = await initSessionStore(
    env.SESSIONS_PATH?.trim() || undefined,
  );
  const pruned = await pruneOldSessions(14);
  app.log.info(
    { path: sessionStore.path, pruned },
    "Session memory store ready",
  );

  const accountStore = await initAccountStore(env.ACCOUNTS_PATH?.trim() || undefined);
  app.log.info(
    {
      path: accountStore.path,
      accounts: accountStore.accounts,
      provider: accountStore.provider,
      jsonLoaded: accountStore.jsonLoaded,
    },
    "Account store ready",
  );

  const pushStore = await initPushStore();
  app.log.info(
    { path: pushStore.path, count: pushStore.count, configured: isWebPushConfigured() },
    "Web Push store ready",
  );

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

  await app.register(createHealthRoutes(livekit));
  await app.register(createSessionRoutes(sessionManager, media, livekit), {
    prefix: "/api/v1",
  });
  await app.register(createAccountRoutes(sessionManager, media, livekit), {
    prefix: "/api/v1",
  });
  await app.register(createBillingRoutes(), {
    prefix: "/api/v1",
  });
  await app.register(createUploadRoutes(), {
    prefix: "/api/v1",
  });
  await app.register(createPushRoutes(sessionManager), {
    prefix: "/api/v1",
  });
  await app.register(createGenVideoRoutes(), {
    prefix: "/api/v1",
  });

  startResumeExpiryPushCron(sessionManager, app.log);

  app.get("/ws/sessions/:sessionId", { websocket: true }, (socket, request) => {
    void createWebSocketHandler(sessionManager, chat, media)(socket, request);
  });

  return app;
}