/**
 * Redis client singleton — used for session caching and pub/sub.
 */
import RedisModule from "ioredis";

const Redis = RedisModule.default ?? RedisModule;
type RedisClient = InstanceType<typeof Redis>;

let client: RedisClient | null = null;

export function getRedisClient(url?: string): RedisClient | null {
  if (!url) return null;
  if (client) return client;

  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  client.on("error", (err: Error) => {
    console.error("[redis] connection error:", err.message);
  });

  return client;
}

export async function connectRedis(url?: string): Promise<RedisClient | null> {
  const redis = getRedisClient(url);
  if (!redis) return null;

  try {
    await redis.connect();
    console.log("[redis] connected");
    return redis;
  } catch (err) {
    console.error("[redis] failed to connect:", (err as Error).message);
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

export type { RedisClient };
