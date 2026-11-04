import "server-only";

import { randomUUID } from "node:crypto";
import { redis } from "@/server/security/rateLimit";

const LOCK_TTL_SECONDS = 120;

export async function acquireConversationLock(
  conversationId: string,
): Promise<string | null> {
  const token = randomUUID();

  const result = await redis.set(`lock:conversation:${conversationId}`, token, {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });

  return result === "OK" ? token : null;
}

export async function releaseConversationLock(
  conversationId: string,
  token: string,
): Promise<void> {
  const key = `lock:conversation:${conversationId}`;

  // Libera somente se o token ainda pertencer
  // à operação que adquiriu o bloqueio.
  await redis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `,
    [key],
    [token],
  );
}

export async function renewConversationLock(
  conversationId: string,
  token: string,
): Promise<boolean> {
  const result = await redis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("EXPIRE", KEYS[1], ARGV[2])
      end
      return 0
    `,
    [`lock:conversation:${conversationId}`],
    [token, "120"],
  );

  return result === 1;
}
