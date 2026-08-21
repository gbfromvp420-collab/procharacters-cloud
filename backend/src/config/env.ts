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
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  /** Public API base URL for WebSocket links (e.g. https://api.procharacters.cloud) */
  PUBLIC_API_URL: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), {
      message: "PUBLIC_API_URL must start with http:// or https://",
    }),
  /** JSON file for runtime custom characters (use a Railway volume path in prod). */
  CUSTOM_CHARACTERS_PATH: z.string().optional(),
  /** Directory for persisted session transcripts (Railway volume recommended). */
  SESSIONS_PATH: z.string().optional(),
  /** Accounts + resume-code index JSON (Railway volume recommended). */
  ACCOUNTS_PATH: z.string().optional(),
  /**
   * Auth backend for handle/passphrase create/login/token resolve/logout.
   * `json` (default) = file store; `prisma` = Postgres (requires DATABASE_URL).
   * Resume codes / magic links / billing still use the JSON store.
   */
  ACCOUNTS_PROVIDER: z.enum(["json", "prisma"]).default("json"),
  /** Postgres connection string (required when ACCOUNTS_PROVIDER=prisma). */
  DATABASE_URL: z.string().optional(),
  /** Resend API key for magic-link emails (optional — without it, API returns the link). */
  RESEND_API_KEY: z.string().optional(),
  MAGIC_LINK_FROM: z.string().optional(),
  /** Frontend origin used in magic links, e.g. https://procharacters-web-….up.railway.app */
  MAGIC_LINK_BASE_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const livekitConfigured =
  !!parsed.data.LIVEKIT_URL && !!parsed.data.LIVEKIT_API_KEY && !!parsed.data.LIVEKIT_API_SECRET;

export const env = {
  ...parsed.data,
  repoRoot: parsed.data.REPO_ROOT ?? resolveRepoRoot(),
  isDev: parsed.data.NODE_ENV === "development",
  livekitConfigured,
  accountsProvider: parsed.data.ACCOUNTS_PROVIDER,
};
