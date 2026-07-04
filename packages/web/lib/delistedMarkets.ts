import "server-only";
import { redis } from "./redis";

// Server-only: like verification status (lib/verifiedMarkets.ts), delisting
// is admin-curated off-chain metadata rather than an on-chain field —
// hiding a market from the browse page doesn't need a contract upgrade, and
// a delisted market keeps trading/settling normally on-chain for anyone
// with a direct link (see app/api/admin/delist-market/route.ts for how the
// toggle is authenticated). Falls back to "nothing is delisted" if no
// REDIS_URL is configured, so the rest of the app degrades gracefully
// instead of crashing.

const KEY_PREFIX = "hoodmarkets:delisted-market:";

export async function isMarketDelisted(marketId: string): Promise<boolean> {
  if (!redis) return false;
  return (await redis.get(`${KEY_PREFIX}${marketId}`)) === "1";
}

export async function getDelistedMarketIds(marketIds: string[]): Promise<string[]> {
  if (!redis || marketIds.length === 0) return [];
  const keys = marketIds.map((id) => `${KEY_PREFIX}${id}`);
  const values = await redis.mget(...keys);
  return marketIds.filter((_, i) => values[i] === "1");
}

export async function getAllDelistedMarketIds(): Promise<string[]> {
  if (!redis) return [];
  const keys = await redis.keys(`${KEY_PREFIX}*`);
  return keys.map((k) => k.slice(KEY_PREFIX.length));
}

export async function setMarketDelisted(marketId: string, delisted: boolean): Promise<void> {
  if (!redis) throw new Error("Delisting is not configured (missing REDIS_URL).");
  if (delisted) await redis.set(`${KEY_PREFIX}${marketId}`, "1");
  else await redis.del(`${KEY_PREFIX}${marketId}`);
}
