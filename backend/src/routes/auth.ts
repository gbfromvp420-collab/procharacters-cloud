/**
 * Auth routes — registration, login, profile.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthError, requireAuth, type UserService } from "../lib/auth/index.js";

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function createAuthRoutes(userService: UserService) {
  return async (app: FastifyInstance) => {
    /* ── Register ─────────────────────────────────────── */
    app.post("/auth/register", {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    }, async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
      }

      try {
        const { user, token } = await userService.register(
          parsed.data.email,
          parsed.data.username,
          parsed.data.password,
          parsed.data.displayName,
        );
        return reply.status(201).send({ user, token });
      } catch (err) {
        if (err instanceof AuthError) {
          const status = err.code === "USER_EXISTS" ? 409 : 400;
          return reply.status(status).send({ error: err.message });
        }
        throw err;
      }
    });

    /* ── Login ────────────────────────────────────────── */
    app.post("/auth/login", {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    }, async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
      }

      try {
        const { user, token } = await userService.login(parsed.data.email, parsed.data.password);
        return { user, token };
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.status(401).send({ error: err.message });
        }
        throw err;
      }
    });

    /* ── Get current user (protected) ────────────────── */
    app.get("/auth/me", { preHandler: [requireAuth] }, async (request, reply) => {
      const user = await userService.getUser(request.user!.userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return { user };
    });
  };
}
