import { HttpError } from "../http";
import { secondsToNextUtcDay, unlimitedAccounts } from "../cloud/repository";
import {
  DAILY_READ_LIMIT,
  meterDatabase,
  READ_RECORD_MIN_ROWS,
  recordReads,
} from "./read-budget";
import type { AgentEnv } from "./types";

/** Seconds a throttled account waits; the limiter counts per minute. */
export const USER_RATE_LIMIT_RETRY_AFTER = "60";
/** The service_flags row the usage workflow sets while the D1 quota runs low. */
export const AGENT_PAUSED_FLAG = "agent_paused";

export interface GuardOptions {
  /** MCP and access-link work, which the low-quota switch pauses. */
  agent?: boolean;
  now?: number;
}

/**
 * Runs before every signed-in request, whether it came with a Firebase token,
 * an MCP grant or an access link. The throttle comes first so a burst costs
 * no D1 read; it is approximate and per location, so it caps bursts while the
 * daily limits cap the day. One query then reads the disabled list, the
 * account's reads today and the low-quota switch.
 */
export async function guardAccount(
  env: AgentEnv,
  uid: string,
  options: GuardOptions = {},
): Promise<void> {
  if (env.USER_LIMITER && !(await env.USER_LIMITER.limit({ key: uid })).success)
    throw new HttpError(
      429,
      "rate_limited",
      undefined,
      USER_RATE_LIMIT_RETRY_AFTER,
    );
  const now = options.now ?? Date.now();
  const state = await env.AGENT_DB.prepare(
    "SELECT EXISTS(SELECT 1 FROM disabled_accounts WHERE uid=?1) AS disabled,(SELECT rows FROM account_reads WHERE uid=?1 AND day=?2) AS reads,EXISTS(SELECT 1 FROM service_flags WHERE name=?3) AS paused",
  )
    .bind(uid, new Date(now).toISOString().slice(0, 10), AGENT_PAUSED_FLAG)
    .first<{ disabled: number; reads: number | null; paused: number }>();
  if (state?.disabled) throw new HttpError(403, "account_disabled");
  if (
    (state?.reads ?? 0) >= DAILY_READ_LIMIT &&
    !unlimitedAccounts(env.UNLIMITED_UIDS).has(uid)
  )
    throw new HttpError(
      429,
      "daily_read_limit",
      undefined,
      secondsToNextUtcDay(now),
    );
  if (options.agent && state?.paused)
    throw new HttpError(503, "agent_paused", undefined, "3600");
}

/**
 * Guards the request, runs it against metered D1 bindings and adds what it
 * read to the account's day. A failure to record never fails the request.
 */
export async function guarded<T>(
  env: AgentEnv,
  uid: string,
  options: GuardOptions,
  run: (env: AgentEnv) => Promise<T>,
): Promise<T> {
  await guardAccount(env, uid, options);
  const meter = { rows: 0 };
  try {
    return await run({
      ...env,
      CLOUD_DB: meterDatabase(env.CLOUD_DB, meter),
      AGENT_DB: meterDatabase(env.AGENT_DB, meter),
    });
  } finally {
    if (meter.rows >= READ_RECORD_MIN_ROWS)
      await recordReads(env.AGENT_DB, uid, meter.rows, options.now).catch(
        () => {},
      );
  }
}
