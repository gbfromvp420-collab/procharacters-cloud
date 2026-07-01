/**
 * Fastify auth middleware — extracts and validates JWT from Authorization header.
 * Attaches user info to request for downstream handlers.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken, type JwtPayload } from "./jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/**
 * Auth hook — requires valid JWT ******
 * Use as a preHandler on protected routes.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Authorization header required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    request.user = verifyToken(token);
  } catch {
    reply.status(401).send({ error: "Invalid or expired token" });
  }
}

/**
 * Optional auth — attaches user if valid token present, but doesn't block.
 * Useful for routes that work for both authenticated and anonymous users.
 */
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return;

  const token = authHeader.slice(7);
  try {
    request.user = verifyToken(token);
  } catch {
    // Invalid token — just continue as anonymous
  }
}
