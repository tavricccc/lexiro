import type { D1Database } from "@cloudflare/workers-types";
import { HttpError } from "../http";

// Fixed 60 second window: at most one upsert per key per window, which keeps
// D1 writes minimal for the free CPU budget. Sliding windows need extra reads
// and writes and are intentionally not used.
export const RATE_LIMIT_WINDOW_MS = 60_000;
// /authorize is the normal entry point of every connection and shared NAT or
// campus egress IPs may cover many people, so it keeps a generous allowance.
export const RATE_LIMIT_AUTHORIZE_MAX = 60;
// A client only registers once, so a small per-minute allowance still stops
// bulk dynamic client registration without hurting real users.
export const RATE_LIMIT_OAUTH_REGISTER_MAX = 10;
// How long stale counters are kept before the Agent Cron removes them. Only
// needs to exceed the window length; it reuses the existing 7 day cutoff.
export const RATE_LIMIT_RETENTION_MS = 7 * 86400000;
export const RATE_LIMIT_PURGE_SQL =
  "DELETE FROM agent_rate_limits WHERE window_start<?";

export type RateLimitEndpoint = "authorize" | "oauth_register";

const LIMITS: Record<RateLimitEndpoint, number> = {
  authorize: RATE_LIMIT_AUTHORIZE_MAX,
  oauth_register: RATE_LIMIT_OAUTH_REGISTER_MAX,
};

// Split per endpoint so quotas do not collide, and never include the uid so
// the counter stays free of account data. A missing header (local dev or non
// edge runtimes) still counts against a fixed placeholder instead of allowing
// unlimited traffic.
export function rateLimitKey(
  endpoint: RateLimitEndpoint,
  ip: string | null,
): string {
  return `${endpoint}:${ip ?? "unknown"}`;
}

// One statement both creates the window row and increments it atomically.
// Concurrent requests either insert or update, so the count is never lost.
// `now` is injected for deterministic tests.
export async function checkRateLimit(
  db: D1Database,
  endpoint: RateLimitEndpoint,
  request: Request,
  now: number,
): Promise<void> {
  const windowStart =
    Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const key = rateLimitKey(endpoint, request.headers.get("CF-Connecting-IP"));
  try {
    const row = await db
      .prepare(
        "INSERT INTO agent_rate_limits(key,window_start,count) VALUES(?1,?2,1) ON CONFLICT(key,window_start) DO UPDATE SET count=count+1 RETURNING count",
      )
      .bind(key, windowStart)
      .first<{ count: number }>();
    if ((row?.count ?? 1) > LIMITS[endpoint]) {
      const retryAfter = Math.max(
        1,
        Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
      );
      throw new HttpError(429, "rate_limited", undefined, String(retryAfter));
    }
  } catch (reason) {
    // The limit is a throttle, not a security boundary, so a D1 outage must
    // fail open. Only our own 429 passes through.
    if (reason instanceof HttpError) throw reason;
  }
}
