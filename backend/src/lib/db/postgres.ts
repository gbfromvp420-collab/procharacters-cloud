/**
 * PostgreSQL connection pool — used for persistent storage.
 */
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(databaseUrl?: string): pg.Pool | null {
  if (!databaseUrl) return null;
  if (pool) return pool;

  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on("error", (err) => {
    console.error("[postgres] unexpected pool error:", err.message);
  });

  return pool;
}

export async function connectPostgres(databaseUrl?: string): Promise<pg.Pool | null> {
  const p = getPool(databaseUrl);
  if (!p) return null;

  try {
    const client = await p.connect();
    client.release();
    console.log("[postgres] connected");
    return p;
  } catch (err) {
    console.error("[postgres] failed to connect:", (err as Error).message);
    return null;
  }
}

export async function disconnectPostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
