import { Redis } from '@upstash/redis';

const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const kv = kvUrl && kvToken ? new Redis({
  url: kvUrl,
  token: kvToken,
}) : null;

export const hasKV = !!kv;
