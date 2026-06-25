import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { resolveRepoRoot } from "../lib/paths.js";

loadDotenv();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  REPO_ROOT: z.string().optional(),
  DEFAULT_CHARACTER_ID: z.string().default("twink-default"),
  SESSION_TTL_MINUTES: z.coerce.number().default(120),
  MAX_MESSAGE_WINDOW: z.coerce.number().default(30),
  XAI_API_KEY: z.string().optional(),
  XAI_MODEL: z.string().default("grok-3"),
  XAI_BASE_URL: z.string().default("https://api.x.ai/v1"),
  XAI_MAX_COMPLETION_TOKENS: z.coerce.number().default(1024),
  XAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.85),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  repoRoot: parsed.data.REPO_ROOT ?? resolveRepoRoot(),
  isDev: parsed.data.NODE_ENV === "development",
};