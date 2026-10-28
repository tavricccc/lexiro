import { HttpError } from "../http";
import type { AgentEnv } from "./types";

/** Seconds a throttled account waits; the limiter counts per minute. */
export const USER_RATE_LIMIT_RETRY_AFTER = "60";

/**
 * Runs before every signed-in request, whether it came with a Firebase token,
 * an MCP grant or an access link. The throttle comes first so a burst costs
 * no D1 read; it is approximate and per location, so it caps bursts while the
 * per-account write limit in the repository caps the day.
 */
export async function guardAccount(env: AgentEnv, uid: string): Promise<void> {
  if (env.USER_LIMITER && !(await env.USER_LIMITER.limit({ key: uid })).success)
    throw new HttpError(
      429,
      "rate_limited",
      undefined,
      USER_RATE_LIMIT_RETRY_AFTER,
    );
  const disabled = await env.AGENT_DB.prepare(
    "SELECT 1 FROM disabled_accounts WHERE uid=?",
  )
    .bind(uid)
    .first();
  if (disabled) throw new HttpError(403, "account_disabled");
}
