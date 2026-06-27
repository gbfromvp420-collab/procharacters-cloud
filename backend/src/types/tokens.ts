/**
 * Token / Credits system types.
 *
 * Tokens are the in-platform currency used for:
 * - Live video interaction minutes (Platinum Companion)
 * - Tipping cam models
 * - Sending gifts
 * - Requesting custom actions ("make them do something")
 * - Requesting NSFW image / video generation
 */

export type TokenTransactionType =
  | "purchase"
  | "grant"
  | "tip"
  | "gift"
  | "media_generation"
  | "live_minute"
  | "command_request"
  | "refund";

export interface TokenBalance {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  type: TokenTransactionType;
  amount: number;
  /** Positive = credit, negative = debit */
  delta: number;
  balanceAfter: number;
  metadata?: Record<string, string>;
  createdAt: string;
}

export type SubscriptionTier = "free" | "gold" | "platinum";

export interface TierConfig {
  tier: SubscriptionTier;
  monthlyTokens: number;
  maxSessionMinutes: number;
  mediaGenerationsPerDay: number;
  customCharacters: boolean;
  liveCamAccess: boolean;
  multiCharacterScenes: boolean;
  priorityQueue: boolean;
}

/** Cost table for token-consuming actions. */
export interface TokenCosts {
  liveMinute: number;
  tip: number;
  giftSmall: number;
  giftMedium: number;
  giftLarge: number;
  imageGeneration: number;
  videoGeneration: number;
  commandBasic: number;
  commandPremium: number;
}
