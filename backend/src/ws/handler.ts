import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { z } from "zod";
import type { ChatOrchestrator } from "../services/chat-orchestrator.js";
import type { MediaWorker } from "../services/media-worker.js";
import type { SessionManager } from "../services/session-manager.js";
import { SessionAuthError, SessionNotFoundError } from "../services/session-manager.js";
import type { ClientEvent, ServerEvent } from "../types/websocket.js";

const clientEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user_message"),
    content: z.string().min(1).max(4000),
  }),
  z.object({ type: z.literal("ping") }),
  z.object({ type: z.literal("end_session") }),
]);

function send(socket: WebSocket, event: ServerEvent): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

export function createWebSocketHandler(
  sessionManager: SessionManager,
  chat: ChatOrchestrator,
  media: MediaWorker,
) {
  return async (socket: WebSocket, request: FastifyRequest) => {
    const { sessionId } = request.params as { sessionId: string };
    const query = request.query as { token?: string };
    const token = query.token;

    if (!token) {
      send(socket, { type: "error", code: "AUTH_REQUIRED", message: "Missing session token" });
      socket.close(4401, "Missing session token");
      return;
    }

    let session;
    try {
      session = sessionManager.authenticate(sessionId, token);
    } catch (error) {
      const message =
        error instanceof SessionNotFoundError || error instanceof SessionAuthError
          ? error.message
          : "Unauthorized";
      send(socket, { type: "error", code: "AUTH_FAILED", message });
      socket.close(4403, message);
      return;
    }

    const initialAvatar = media.enrich(session.characterId, session.avatarState);

    send(socket, {
      type: "session_ready",
      sessionId: session.id,
      characterId: session.characterId,
      characterName: session.promptSnapshot.characterName,
      avatarState: initialAvatar,
    });

    /* ── Heartbeat: close zombie connections after 60s without pong ── */
    let isAlive = true;
    const heartbeat = setInterval(() => {
      if (!isAlive) {
        socket.terminate();
        return;
      }
      isAlive = false;
      socket.ping();
    }, 30_000);

    socket.on("pong", () => {
      isAlive = true;
    });

    socket.on("close", () => {
      clearInterval(heartbeat);
    });

    socket.on("message", async (raw) => {
      let parsed: ClientEvent;

      try {
        const json = JSON.parse(raw.toString());
        parsed = clientEventSchema.parse(json);
      } catch {
        send(socket, {
          type: "error",
          code: "INVALID_EVENT",
          message: "Malformed WebSocket event",
        });
        return;
      }

      try {
        switch (parsed.type) {
          case "ping":
            send(socket, { type: "pong" });
            break;

          case "end_session":
            sessionManager.endSession(sessionId, "client_end");
            send(socket, { type: "session_ended", reason: "client_end" });
            socket.close(1000, "Session ended");
            break;

          case "user_message": {
            const result = await chat.handleUserMessage(sessionId, parsed.content);
            const avatarState = await media.publish(
              sessionId,
              session.characterId,
              result.avatarIntent,
            );

            for (const chunk of result.content.split(" ")) {
              send(socket, {
                type: "assistant_stream",
                chunk: `${chunk} `,
                messageId: result.messageId,
              });
            }

            send(socket, {
              type: "assistant_complete",
              messageId: result.messageId,
              content: result.content,
              avatarIntent: avatarState,
            });

            send(socket, {
              type: "avatar_update",
              avatarState,
            });
            break;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send(socket, { type: "error", code: "HANDLER_ERROR", message });
      }
    });
  };
}