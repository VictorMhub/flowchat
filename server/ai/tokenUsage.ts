import "server-only";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export async function recordTokenUsage(userId: string, usage: TokenUsage) {
  const day = new Date().toISOString().slice(0, 10);

  const userKey = `tokens:user:${userId}:${day}`;
  const globalKey = `tokens:global:${day}`;

  const pipeline = redis.pipeline();

  for (const key of [userKey, globalKey]) {
    pipeline.hincrby(key, "input", usage.inputTokens);
    pipeline.hincrby(key, "output", usage.outputTokens);
    pipeline.hincrby(key, "total", usage.totalTokens);
    pipeline.expire(key, 60 * 60 * 24 * 30);
  }

  await pipeline.exec();
}
