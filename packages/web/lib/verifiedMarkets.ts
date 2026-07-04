import "server-only";
import { redis } from "./redis";

// Server-only: verification status is admin-curated off-chain metadata, not
// part of the on-chain Market struct — see docs/notes on lib/category.ts for
// why category/image *are* encoded on-chain (set once at creation) while
// this isn't (toggled after the fact, by whoever holds admin — see
// app/api/admin/verify-market/route.ts for how that's authenticated).
// Falls back to "nothing is verified" if no REDIS_URL is configured, so the
// rest of the app degrades gracefully instead of crashing.

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
