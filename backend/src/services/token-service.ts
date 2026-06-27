/**
 * Token service — manages user balances and transactions.
 *
 * In-memory for v2 MVP; swap to PostgreSQL when accounts ship.
 */

import { v4 as uuid } from "uuid";
import type {
  SubscriptionTier,
  TierConfig,
  TokenBalance,
  TokenCosts,
  TokenTransaction,
  TokenTransactionType,
} from "../types/tokens.js";

/** Default cost table (in tokens). */
const DEFAULT_COSTS: TokenCosts = {
  liveMinute: 5,
  tip: 1, // minimum tip = 1 token
  giftSmall: 10,
  giftMedium: 25,
  giftLarge: 100,
  imageGeneration: 15,
  videoGeneration: 50,
  commandBasic: 5,
  commandPremium: 20,
};

/** Tier configuration. */
const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  free: {
    tier: "free",
    monthlyTokens: 50,
    maxSessionMinutes: 10,
    mediaGenerationsPerDay: 2,
    customCharacters: false,
    liveCamAccess: true,
    multiCharacterScenes: false,
    priorityQueue: false,
  },
  gold: {
    tier: "gold",
    monthlyTokens: 500,
    maxSessionMinutes: 60,
    mediaGenerationsPerDay: 20,
    customCharacters: false,
    liveCamAccess: true,
    multiCharacterScenes: false,
    priorityQueue: false,
  },
  platinum: {
    tier: "platinum",
    monthlyTokens: 2000,
    maxSessionMinutes: 240,
    mediaGenerationsPerDay: 100,
    customCharacters: true,
    liveCamAccess: true,
    multiCharacterScenes: true,
    priorityQueue: true,
  },
};

export class TokenService {
  private balances = new Map<string, TokenBalance>();
  private transactions: TokenTransaction[] = [];
  private costs: TokenCosts;

  constructor(costs?: Partial<TokenCosts>) {
    this.costs = { ...DEFAULT_COSTS, ...costs };
  }

  /* ── Balance management ─────────────────────────────── */

  getBalance(userId: string): TokenBalance {
    let bal = this.balances.get(userId);
    if (!bal) {
      bal = {
        userId,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      };
      this.balances.set(userId, bal);
    }
    return { ...bal };
  }

  /** Credit tokens (purchase, grant, refund). */
  credit(userId: string, amount: number, type: TokenTransactionType, metadata?: Record<string, string>): TokenTransaction {
    if (amount <= 0) throw new TokenError("Credit amount must be positive");
    const bal = this.ensureBalance(userId);
    bal.balance += amount;
    bal.lifetimeEarned += amount;
    bal.updatedAt = new Date().toISOString();
    return this.recordTransaction(userId, type, amount, amount, bal.balance, metadata);
  }

  /** Debit tokens (tip, gift, media gen, live minute). */
  debit(userId: string, amount: number, type: TokenTransactionType, metadata?: Record<string, string>): TokenTransaction {
    if (amount <= 0) throw new TokenError("Debit amount must be positive");
    const bal = this.ensureBalance(userId);
    if (bal.balance < amount) {
      throw new InsufficientTokensError(userId, bal.balance, amount);
    }
    bal.balance -= amount;
    bal.lifetimeSpent += amount;
    bal.updatedAt = new Date().toISOString();
    return this.recordTransaction(userId, type, amount, -amount, bal.balance, metadata);
  }

  /** Check if user can afford an action. */
  canAfford(userId: string, amount: number): boolean {
    return this.getBalance(userId).balance >= amount;
  }

  /* ── Cost helpers ───────────────────────────────────── */

  getCosts(): TokenCosts {
    return { ...this.costs };
  }

  getCostForAction(action: keyof TokenCosts): number {
    return this.costs[action];
  }

  /* ── Tier management ────────────────────────────────── */

  getTierConfig(tier: SubscriptionTier): TierConfig {
    return { ...TIER_CONFIGS[tier] };
  }

  getAllTiers(): TierConfig[] {
    return Object.values(TIER_CONFIGS).map((t) => ({ ...t }));
  }

  /** Grant monthly tokens for a tier. */
  grantMonthlyTokens(userId: string, tier: SubscriptionTier): TokenTransaction {
    const config = TIER_CONFIGS[tier];
    return this.credit(userId, config.monthlyTokens, "grant", { tier, reason: "monthly_grant" });
  }

  /* ── Transaction history ────────────────────────────── */

  getTransactions(userId: string, limit = 50): TokenTransaction[] {
    return this.transactions
      .filter((t) => t.userId === userId)
      .slice(-limit);
  }

  /* ── Private helpers ────────────────────────────────── */

  private ensureBalance(userId: string): TokenBalance {
    let bal = this.balances.get(userId);
    if (!bal) {
      bal = {
        userId,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      };
      this.balances.set(userId, bal);
    }
    return bal;
  }

  private recordTransaction(
    userId: string,
    type: TokenTransactionType,
    amount: number,
    delta: number,
    balanceAfter: number,
    metadata?: Record<string, string>,
  ): TokenTransaction {
    const tx: TokenTransaction = {
      id: uuid(),
      userId,
      type,
      amount,
      delta,
      balanceAfter,
      metadata,
      createdAt: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return tx;
  }
}

/* ── Error classes ──────────────────────────────────────── */

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

export class InsufficientTokensError extends TokenError {
  constructor(
    public readonly userId: string,
    public readonly currentBalance: number,
    public readonly required: number,
  ) {
    super(`Insufficient tokens: have ${currentBalance}, need ${required}`);
    this.name = "InsufficientTokensError";
  }
}
