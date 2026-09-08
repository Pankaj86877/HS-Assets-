import { Redis } from '@upstash/redis';

export function getKV() {
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    return new Redis({
      url: kvUrl,
      token: kvToken,
    });
  }
  return null;
}
