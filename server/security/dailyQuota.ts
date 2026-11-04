
import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/server/security/rateLimit";

const DAILY_USER_LIMIT = 20;
const DAILY_GLOBAL_LIMIT = 200;

const userDailyQuota = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(
    DAILY_USER_LIMIT,
    "24 h",
  ),
  prefix: "quota:gemini:user",
});

const globalDailyQuota = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(
    DAILY_GLOBAL_LIMIT,
    "24 h",
  ),
  prefix: "quota:gemini:global",
});

export async function checkDailyQuota(
  userId: string,
): Promise<
  | { allowed: true }
  | {
      allowed: false;
      reason: "user" | "global";
      retryAfter: number;
    }
> {
  // Verifica o limite global primeiro.
  const global = await globalDailyQuota.limit(
    "all",
  );

  if (!global.success) {
    return {
      allowed: false,
      reason: "global",
      retryAfter: Math.max(
        1,
        Math.ceil((global.reset - Date.now()) / 1000),
      ),
    };
  }

  const user = await userDailyQuota.limit(userId);

  if (!user.success) {
    return {
      allowed: false,
      reason: "user",
      retryAfter: Math.max(
        1,
        Math.ceil((user.reset - Date.now()) / 1000),
      ),
    };
  }

  return { allowed: true };
}
