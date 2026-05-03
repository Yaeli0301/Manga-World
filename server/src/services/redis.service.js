import Redis from "ioredis";

let client;

/**
 * @returns {Redis | null}
 */
export function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: process.env.NODE_ENV === "test",
    });
    client.on("error", (err) => {
      if (process.env.NODE_ENV !== "test") console.warn("[redis]", err.message);
    });
  }
  return client;
}

export async function cacheGetJSON(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cacheSetJSON(key, value, ttlSec = 120) {
  const r = getRedis();
  if (!r) return false;
  try {
    await r.set(key, JSON.stringify(value), "EX", ttlSec);
    return true;
  } catch {
    return false;
  }
}

export async function cacheDelPattern(pattern) {
  const r = getRedis();
  if (!r) return;
  try {
    const keys = await r.keys(pattern);
    if (keys.length) await r.del(...keys);
  } catch {
    /* ignore */
  }
}
