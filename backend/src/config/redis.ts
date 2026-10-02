import Redis from "ioredis";
import { ENV } from "./env";

let redis: Redis | null = null;

export const getRedis = (): Redis => {
  if (!redis) {
    try {
      redis = new Redis(ENV.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });
      redis.on("error", (err) => {
        console.log("[Redis] Connection failed, running without cache:", err.message);
        redis = null;
      });
    } catch {
      console.log("[Redis] Not available, running without cache");
    }
  }
  return redis!;
};

export default getRedis;
