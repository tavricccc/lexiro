import type { D1Database } from "@cloudflare/workers-types";
import { nowSeconds, settle, type Reservation, type Settlement, type Usage } from "./billing";
import { creditsFromUsage } from "./credits";
import type { Env } from "./env";

export type UsageRecovery = (cursor: string) => Promise<Record<string, unknown> | undefined>;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const tokens = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Missing or malformed usage is unknown, never a zero-cost response. */
export function reportedUsage(response: Record<string, unknown> | undefined, model: string): Usage | undefined {
  if (!response || !record(response.usage)) return;
  const usage = response.usage;
  if (!tokens(usage.input_tokens) || !tokens(usage.output_tokens)) return;
  const details = usage.input_tokens_details;
  if (details != null && !record(details)) return;
  const cached = record(details) && "cached_tokens" in details ? details.cached_tokens : 0;
  const cacheWrite = record(details) && "cache_write_tokens" in details ? details.cache_write_tokens : 0;
  if (!tokens(cached) || !tokens(cacheWrite) || cached + cacheWrite > usage.input_tokens) return;
  return { model, input: usage.input_tokens, output: usage.output_tokens, cached, cacheWrite };
}

export function createUsageRecovery(env: Env, fetcher: typeof fetch): UsageRecovery {
  return async (cursor) => {
    const response = await fetcher(`${env.OPENAI_BASE_URL}/responses/${encodeURIComponent(cursor)}`, {
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return;
    }
    const value: unknown = await response.json();
    if (record(value) && value.id === cursor &&
        ["completed", "incomplete", "failed", "cancelled"].includes(String(value.status))) return value;
  };
}

/** Keep chargeable holds until the provider reports usage; failed runs release theirs. */
export async function deferUsage(
  db: D1Database,
  reservation: Reservation,
  successfulIds: string[],
  model: string,
  chargeable: boolean,
  metadata: Settlement,
): Promise<void> {
  const { uid, attempt } = reservation;
  if (!metadata.cursor) {
    await settle(db, reservation, reservation.charges, { model }, {
      ...metadata, charged: 0, cost: null, usageState: "unavailable",
    });
    return;
  }
  const statements = [
    db.prepare(`INSERT OR IGNORE INTO usage_log
      (id,uid,points,model,created_at,credits,status,kind,tier,units,usage_state,debit_verified,assessed_points)
      VALUES(?,?,0,?,?,NULL,?,?,?,?, 'pending',?,?)`)
      .bind(attempt, uid, model, nowSeconds(), metadata.status ?? "failed",
        metadata.kind ?? "", metadata.tier ?? "", metadata.units ?? 0,
        chargeable ? 0 : 1, chargeable ? null : 0),
    db.prepare(`INSERT OR IGNORE INTO pending_usage(attempt_id,uid,response_id,model,chargeable,successful_ids)
      SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM usage_log WHERE id=? AND usage_state='pending')`)
      .bind(attempt, uid, metadata.cursor, model, chargeable ? 1 : 0, JSON.stringify(successfulIds), attempt),
    db.prepare("INSERT OR IGNORE INTO cursors(response_id,uid,created_at) VALUES(?,?,?)")
      .bind(metadata.cursor, uid, nowSeconds()),
  ];
  if (!chargeable) {
    statements.push(
      db.prepare(`UPDATE accounts SET version=version+1, points=points+(SELECT COALESCE(SUM(points),0) FROM charges WHERE attempt_id=?)
        WHERE uid=? AND EXISTS(SELECT 1 FROM charges WHERE attempt_id=?)`).bind(attempt, uid, attempt),
      db.prepare("DELETE FROM charges WHERE attempt_id=?").bind(attempt),
      db.prepare("UPDATE accounts SET version=version+1, inflight_id=NULL,inflight_at=NULL WHERE uid=? AND inflight_id=?").bind(uid, attempt),
    );
  }
  await db.batch(statements);
}

interface PendingUsage {
  attempt_id: string;
  uid: string;
  response_id: string;
  model: string;
  chargeable: number;
  successful_ids: string;
  status: string;
  kind: string;
  tier: string;
  units: number;
}

/** Bound both D1 work and provider calls; failed lookups rotate to the back. */
export async function reconcileUsage(db: D1Database, recover: UsageRecovery, uid?: string): Promise<void> {
  const query = `SELECT p.*,u.status,u.kind,u.tier,u.units FROM pending_usage p
    JOIN usage_log u ON u.id=p.attempt_id ${uid === undefined ? "" : "WHERE p.uid=?"}
    ORDER BY p.checked_at,p.attempt_id LIMIT ${uid === undefined ? 5 : 1}`;
  const statement = db.prepare(query);
  const rows = await (uid === undefined ? statement : statement.bind(uid)).all<PendingUsage>();
  for (const row of rows.results) {
    await db.prepare("UPDATE pending_usage SET checked_at=? WHERE attempt_id=?").bind(nowSeconds(), row.attempt_id).run();
    const response = await recover(row.response_id).catch(() => undefined);
    const usage = reportedUsage(response, row.model);
    if (!usage) continue;
    const cost = creditsFromUsage(usage);
    if (cost === null) continue;
    const charges = (await db.prepare("SELECT id,points FROM charges WHERE attempt_id=?")
      .bind(row.attempt_id).all<{ id: string; points: number }>()).results;
    const successful = new Set(JSON.parse(row.successful_ids) as string[]);
    await settle(db, { uid: row.uid, attempt: row.attempt_id, charges },
      charges.filter((charge) => !successful.has(charge.id)), usage, {
        cursor: row.response_id, charged: row.chargeable ? cost : 0, cost,
        status: row.status, kind: row.kind, tier: row.tier, units: row.units,
      });
  }
}
