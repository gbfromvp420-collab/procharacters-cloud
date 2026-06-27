/**
 * Token / credits API routes.
 */

import type { FastifyInstance } from "fastify";
import type { TokenService } from "../services/token-service.js";

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
      const { amount, type, metadata } = request.body;
      if (!amount || amount <= 0) {
        return reply.status(400).send({ error: "Amount must be positive" });
      }
      const tx = tokenService.credit(
        userId,
        amount,
        (type as "purchase" | "grant") ?? "purchase",
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
      const { tier } = request.body;
      if (!["free", "gold", "platinum"].includes(tier)) {
        return reply.status(400).send({ error: "Invalid tier" });
      }
      const tx = tokenService.grantMonthlyTokens(userId, tier as "free" | "gold" | "platinum");
      return { transaction: tx, balance: tokenService.getBalance(userId) };
    });
  };
}
