/**
 * Token / credits API routes.
 */

import type { FastifyInstance } from "fastify";
import type { TokenService } from "../services/token-service.js";
import { creditBodySchema, grantMonthlyBodySchema } from "./schemas.js";

export function createTokenRoutes(tokenService: TokenService) {
  return async function tokenRoutes(app: FastifyInstance) {
    /** Get user balance + cost table. */
    app.get<{ Params: { userId: string } }>(
      "/tokens/:userId/balance",
      async (request) => {
        const { userId } = request.params;
        return {
          balance: tokenService.getBalance(userId),
          costs: tokenService.getCosts(),
        };
      },
    );

    /** Credit tokens (purchase / grant). */
    app.post<{
      Params: { userId: string };
      Body: { amount: number; type?: string; metadata?: Record<string, string> };
    }>("/tokens/:userId/credit", async (request, reply) => {
      const { userId } = request.params;
      const parsed = creditBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
      }
      const { amount, type, metadata } = parsed.data;
      const tx = tokenService.credit(
        userId,
        amount,
        type ?? "purchase",
        metadata,
      );
      return { transaction: tx, balance: tokenService.getBalance(userId) };
    });

    /** Get transaction history. */
    app.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
      "/tokens/:userId/transactions",
      async (request) => {
        const { userId } = request.params;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
        return { transactions: tokenService.getTransactions(userId, limit) };
      },
    );

    /** Get all subscription tiers. */
    app.get("/tokens/tiers", async () => {
      return { tiers: tokenService.getAllTiers() };
    });

    /** Grant monthly tokens for a tier. */
    app.post<{
      Params: { userId: string };
      Body: { tier: string };
    }>("/tokens/:userId/grant-monthly", async (request, reply) => {
      const { userId } = request.params;
      const parsed = grantMonthlyBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
      }
      const tx = tokenService.grantMonthlyTokens(userId, parsed.data.tier);
      return { transaction: tx, balance: tokenService.getBalance(userId) };
    });
  };
}
