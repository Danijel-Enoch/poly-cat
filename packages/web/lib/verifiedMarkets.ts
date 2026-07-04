import "server-only";
import Redis from "ioredis";

// Server-only: verification status is admin-curated off-chain metadata, not
// part of the on-chain Market struct — see docs/notes on lib/category.ts for
// why category/image *are* encoded on-chain (set once at creation) while
// this isn't (toggled after the fact, by whoever holds admin — see
// app/api/admin/verify-market/route.ts for how that's authenticated).
// Falls back to "nothing is verified" if no REDIS_URL is configured, so the
// rest of the app degrades gracefully instead of crashing.

// Cache the client on globalThis so Next.js dev's hot-reload (which
// re-evaluates this module on every edit) reuses one TCP connection instead
// of leaking a new one each time — the same pattern commonly used for a
// Prisma client singleton.
const globalForRedis = globalThis as unknown as { redis?: Redis };

const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? (globalForRedis.redis ?? new Redis(redisUrl, { lazyConnect: true })) : null;
if (redis && process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

const KEY_PREFIX = "hoodmarkets:verified-market:";

export async function isMarketVerified(marketId: string): Promise<boolean> {
  if (!redis) return false;
  return (await redis.get(`${KEY_PREFIX}${marketId}`)) === "1";
}

export async function getVerifiedMarketIds(marketIds: string[]): Promise<string[]> {
  if (!redis || marketIds.length === 0) return [];
  const keys = marketIds.map((id) => `${KEY_PREFIX}${id}`);
  const values = await redis.mget(...keys);
  return marketIds.filter((_, i) => values[i] === "1");
}

export async function getAllVerifiedMarketIds(): Promise<string[]> {
  if (!redis) return [];
  const keys = await redis.keys(`${KEY_PREFIX}*`);
  return keys.map((k) => k.slice(KEY_PREFIX.length));
}

export async function setMarketVerified(marketId: string, verified: boolean): Promise<void> {
  if (!redis) throw new Error("Verification is not configured (missing REDIS_URL).");
  if (verified) await redis.set(`${KEY_PREFIX}${marketId}`, "1");
  else await redis.del(`${KEY_PREFIX}${marketId}`);
}
