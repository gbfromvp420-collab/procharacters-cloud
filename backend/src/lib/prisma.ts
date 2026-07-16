import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: pg.Pool;
};

/**
 * Lazy Prisma client (Prisma 7 requires a driver adapter).
 * Only constructed on first use — JSON auth mode never touches Postgres.
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required when using Prisma (set ACCOUNTS_PROVIDER=json to stay on file auth)",
    );
  }

  const pool =
    globalForPrisma.prismaPool ??
    new pg.Pool({
      connectionString: url,
      max: Number(process.env.PRISMA_POOL_MAX ?? 10),
    });
  globalForPrisma.prismaPool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Proxy so existing `import { prisma }` call sites stay unchanged. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Lightweight health probe — does not throw; safe for /health. */
export async function pingPrisma(timeoutMs = 800): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "DATABASE_URL unset" };
  }
  const started = Date.now();
  try {
    const race = await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    void race;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "prisma_ping_failed",
    };
  }
}
