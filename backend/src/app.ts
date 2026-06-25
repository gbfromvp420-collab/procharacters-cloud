import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { createSessionRoutes } from "./routes/sessions.js";
import { ChatOrchestrator } from "./services/chat-orchestrator.js";
import { MemoryManager } from "./services/memory-manager.js";
import { SessionManager } from "./services/session-manager.js";
import { createWebSocketHandler } from "./ws/handler.js";

export async function buildApp() {
  const app = Fastify({
    logger: env.isDev,
  });

  await app.register(cors, { origin: true });
  await app.register(websocket);

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

  if (!env.XAI_API_KEY) {
    app.log.warn("XAI_API_KEY not set — chat will use stub replies until configured");
  } else {
    app.log.info({ model: env.XAI_MODEL }, "Grok/xAI chat enabled");
  }

  await app.register(healthRoutes);
  await app.register(createSessionRoutes(sessionManager), { prefix: "/api/v1" });

  app.get("/ws/sessions/:sessionId", { websocket: true }, (socket, request) => {
    void createWebSocketHandler(sessionManager, chat)(socket, request);
  });

  return app;
}