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
