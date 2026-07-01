/**
 * Zod validation schemas for route request bodies.
 * Provides runtime validation beyond TypeScript generics.
 */

import { z } from "zod";

/* ── Token routes ──────────────────────────────────────── */

export const creditBodySchema = z.object({
  amount: z.number().int().positive("Amount must be a positive integer"),
  type: z.enum(["purchase", "grant"]).optional(),
  metadata: z.record(z.string()).optional(),
});

export const grantMonthlyBodySchema = z.object({
  tier: z.enum(["free", "gold", "platinum"]),
});

/* ── Live cam routes ───────────────────────────────────── */

export const createRoomBodySchema = z.object({
  characterId: z.string().min(1),
  title: z.string().min(1).max(200),
  tags: z.array(z.string().max(50)).max(10).optional(),
  pairedCharacterId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const userIdBodySchema = z.object({
  userId: z.string().min(1).max(128),
});

export const tipBodySchema = z.object({
  userId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(64),
  amount: z.number().int().positive("Tip amount must be a positive integer"),
  message: z.string().max(500).optional(),
});

export const giftBodySchema = z.object({
  userId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(64),
  giftId: z.string().min(1),
});

export const commandBodySchema = z.object({
  userId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(64),
  commandId: z.string().min(1),
  customPrompt: z.string().max(1000).optional(),
});

export const scheduleShowBodySchema = z.object({
  characterId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().max(480),
  tags: z.array(z.string().max(50)).max(10).optional(),
  pairedCharacterId: z.string().optional(),
});

/* ── Media routes ──────────────────────────────────────── */

export const avatarStateSchema = z.object({
  emotion: z.string().min(1),
  pose: z.string().min(1),
  action: z.string().min(1),
  arousalLevel: z.number().min(0).max(10),
  clothingState: z.string().min(1),
});

export const mediaGenerateBodySchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1).max(128),
  characterId: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  appearanceRef: z.record(z.string()),
  avatarState: avatarStateSchema,
});
