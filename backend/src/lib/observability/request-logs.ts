import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { bump } from "./metrics.js";
import { reportError } from "./error-reporter.js";

declare module "fastify" {
  interface FastifyRequest {
    requestId?: string;
    _startedAt?: number;
    /** Set when reportError already ran for this request (avoid double webhook). */
    _errorReported?: boolean;
  }
}

/**
 * Structured request logging + request IDs + error handler.
 * Safe for production: no bodies logged (PII / NSFW risk).
 */
export function registerObservability(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => {
    const incoming =
      (typeof request.headers["x-request-id"] === "string" &&
        request.headers["x-request-id"].trim()) ||
      randomUUID();
    request.requestId = incoming.slice(0, 64);
    request._startedAt = Date.now();
  });

  app.addHook("onResponse", async (request, reply) => {
    const durationMs = request._startedAt ? Date.now() - request._startedAt : undefined;
    const statusCode = reply.statusCode;
    bump("httpRequests");
    if (statusCode >= 500) bump("httpErrors5xx");
    else if (statusCode >= 400) bump("httpErrors4xx");

    // Skip noisy health checks at info level
    const path = request.url.split("?")[0] ?? request.url;
    const isHealth = path === "/health" || path === "/";

    const line = {
      requestId: request.requestId,
      method: request.method,
      path,
      statusCode,
      durationMs,
      ip: request.ip,
    };

    if (isHealth && statusCode < 400) {
      app.log.debug(line, "http_request");
      return;
    }

    if (statusCode >= 500) {
      app.log.error(line, "http_request");
      // Catch reply.code(500) paths that never hit setErrorHandler
      if (!request._errorReported) {
        request._errorReported = true;
        await reportError(
          {
            message: `HTTP ${statusCode} (no thrown error)`,
            name: "Http5xx",
            statusCode,
            requestId: request.requestId,
            path,
            method: request.method,
          },
          app.log,
        );
      }
    } else if (statusCode >= 400) {
      app.log.warn(line, "http_request");
    } else {
      app.log.info(line, "http_request");
    }
  });

  app.setErrorHandler(async (error, request, reply) => {
    const statusCode =
      typeof error === "object" &&
      error &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;

    const message = error instanceof Error ? error.message : "Internal Server Error";

    if (statusCode >= 500) {
      request._errorReported = true;
      await reportError(
        {
          message,
          name: error instanceof Error ? error.name : "Error",
          stack: error instanceof Error ? error.stack : undefined,
          statusCode,
          requestId: request.requestId,
          path: request.url.split("?")[0],
          method: request.method,
        },
        app.log,
      );
    } else {
      app.log.warn(
        {
          requestId: request.requestId,
          statusCode,
          message,
          path: request.url.split("?")[0],
        },
        "http_client_error",
      );
    }

    if (reply.sent) return;

    return reply.code(statusCode).send({
      error: statusCode >= 500 ? "Internal Server Error" : message,
      requestId: request.requestId,
      ...(statusCode < 500 && error instanceof Error && "code" in error
        ? { code: (error as { code?: string }).code }
        : {}),
    });
  });

  // Attach request id on all replies when possible
  app.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.requestId) {
      void reply.header("x-request-id", request.requestId);
    }
  });
}
