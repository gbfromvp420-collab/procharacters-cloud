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

  /* ── Media generation provider ─────────────────────── */
  MEDIA_PROVIDER: z.enum(["placeholder", "generic", "internal", "flux", "sdxl"]).default("placeholder"),
  MEDIA_API_KEY: z.string().optional(),
  MEDIA_BASE_URL: z.string().optional(),
  MEDIA_MODEL_ID: z.string().optional(),
  MEDIA_CONCURRENCY: z.coerce.number().default(2),
  MEDIA_WIDTH: z.coerce.number().default(512),
  MEDIA_HEIGHT: z.coerce.number().default(768),
  MEDIA_VIDEO_DURATION: z.coerce.number().default(6),
  MEDIA_SAMPLER: z.string().optional(),
  MEDIA_STEPS: z.coerce.number().optional(),
  MEDIA_CFG_SCALE: z.coerce.number().optional(),

  /* ── ElevenLabs voice generation ─────────────────────── */
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_BASE_URL: z.string().default("https://api.elevenlabs.io/v1"),
  /** Default voice ID for character speech (can be overridden per character). */
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().optional(),
  /** Model ID: eleven_multilingual_v2, eleven_turbo_v2, etc. */
  ELEVENLABS_MODEL_ID: z.string().default("eleven_multilingual_v2"),
  /** Stability (0-1): lower = more expressive, higher = more consistent. */
  ELEVENLABS_STABILITY: z.coerce.number().min(0).max(1).default(0.5),
  /** Similarity boost (0-1): how closely to match the original voice. */
  ELEVENLABS_SIMILARITY_BOOST: z.coerce.number().min(0).max(1).default(0.75),
  /** Style (0-1): amplifies style of original speaker. */
  ELEVENLABS_STYLE: z.coerce.number().min(0).max(1).default(0.4),
  /** Output format: mp3_44100_128, pcm_16000, etc. */
  ELEVENLABS_OUTPUT_FORMAT: z.string().default("mp3_44100_128"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const livekitConfigured =
  !!parsed.data.LIVEKIT_URL &&
  !!parsed.data.LIVEKIT_API_KEY &&
  !!parsed.data.LIVEKIT_API_SECRET;

export const env = {
  ...parsed.data,
  repoRoot: parsed.data.REPO_ROOT ?? resolveRepoRoot(),
  isDev: parsed.data.NODE_ENV === "development",
  livekitConfigured,
};