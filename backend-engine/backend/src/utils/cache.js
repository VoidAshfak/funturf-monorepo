import NodeCache from "node-cache";
import Redis from "ioredis";
import { logger } from "../../logs/logger.js";

// In-memory cache for legacy imports (auth middleware, etc.) — always available.
const userCache = new NodeCache({ stdTTL: 1000, checkperiod: 200 });

// Redis client — created lazily so the app works without Redis running.
let redis = null;
let redisAvailable = false;

if (process.env.REDIS_URL) {
    try {
        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3) {
                    logger.warn("redis: max retries reached — falling back to in-memory cache");
                    redisAvailable = false;
                    return null;
                }
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
        });

        redis.on("connect", () => {
            redisAvailable = true;
            logger.info("redis connected");
        });
        redis.on("error", (err) => {
            redisAvailable = false;
            logger.error(`redis error: ${err.message}`);
        });
        redis.on("close", () => {
            redisAvailable = false;
        });
        redis.on("reconnecting", () => {
            logger.info("redis reconnecting…");
        });

        redis.connect().catch((err) => {
            logger.warn(`redis connection failed: ${err.message} — using in-memory cache`);
            redisAvailable = false;
        });
    } catch (err) {
        logger.warn(`redis init failed: ${err.message} — using in-memory cache`);
    }
} else {
    logger.info("REDIS_URL not set — using in-memory cache");
}

function lkey(key) {
    return `ft:${key}`;
}

export async function get(key) {
    if (redisAvailable) {
        try {
            const raw = await redis.get(lkey(key));
            if (raw === null) return undefined;
            return JSON.parse(raw);
        } catch {
            return userCache.get(key);
        }
    }
    return userCache.get(key);
}

export async function set(key, value, ttl) {
    if (redisAvailable) {
        try {
            const serialized = JSON.stringify(value);
            if (ttl) {
                await redis.setex(lkey(key), ttl, serialized);
            } else {
                await redis.set(lkey(key), serialized);
            }
            return;
        } catch {
            // fall through to in-memory
        }
    }
    userCache.set(key, value, ttl);
}

export async function del(key) {
    if (redisAvailable) {
        try {
            await redis.del(lkey(key));
            return;
        } catch {
            // fall through
        }
    }
    userCache.del(key);
}

export async function delPattern(prefix) {
    if (redisAvailable) {
        try {
            const stream = redis.scanStream({ match: `${lkey(prefix)}*`, count: 100 });
            let pipeline = null;
            for await (const keys of stream) {
                if (keys.length === 0) continue;
                if (!pipeline) pipeline = redis.pipeline();
                for (const key of keys) pipeline.del(key);
            }
            if (pipeline) await pipeline.exec();
            return;
        } catch {
            // fall through
        }
    }
    const keys = userCache.keys().filter((k) => k.startsWith(prefix));
    if (keys.length > 0) userCache.del(keys);
}

export default userCache;
