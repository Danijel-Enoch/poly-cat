import "server-only";
import Redis from "ioredis";

// A single shared client for any small admin-curated off-chain store that
// doesn't warrant its own connection (currently just lib/assetDisplayStore.ts).
// Cached on globalThis so Next.js dev's hot-reload (which re-evaluates
// modules on every edit) reuses one TCP connection instead of leaking a new
// one each time — the same pattern commonly used for a Prisma client
// singleton. `null` if no REDIS_URL is configured, so callers degrade to
// "nothing set" instead of crashing — see assetDisplayStore.ts.
const globalForRedis = globalThis as unknown as { redis?: Redis };

const redisUrl = process.env.REDIS_URL;
export const redis = redisUrl ? (globalForRedis.redis ?? new Redis(redisUrl, { lazyConnect: true })) : null;
if (redis && process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
