import type { D1Database } from "@cloudflare/workers-types";
import type { AdminAccount } from "@lexiro/ai-contract";
import type { UsagePart } from "./usage-parts";

export class BillingError extends Error {
  constructor(public status: 402 | 409 | 429) {
    super(
      status === 402
        ? "insufficient_points"
        : status === 429
          ? "retry_limit"
          : "generation_in_progress",
    );
  }
}
export interface Reservation {
  uid: string;
  attempt: string;
  charges: { id: string; points: number }[];
}
/** A billable unit: `id` makes a retry free, `limitId` bounds how often it may run. */
export interface ChargeUnit {
  id: string;
  limitId: string;
}
export interface Usage {
  model: string;
  input?: number;
  cached?: number;
  cacheWrite?: number;
  output?: number;
}
export interface Settlement {
  usageParts?: readonly UsagePart[];
  cursor?: string;
  /** Assessed points before the balance cap; distinct from the actual debit. */
  charged?: number;
  /** What the provider actually cost, recorded even when nothing was charged. */
  cost?: number | null;
  usageState?: "reported" | "unavailable";
  status?: string;
  /** What the run was, so cost per unit can be read back off the ledger. */
  kind?: string;
  tier?: string;
  units?: number;
}
export const nowSeconds = () => Math.floor(Date.now() / 1000);

export function nextRenewal(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, end));
  return Math.floor(date.getTime() / 1000);
}

export async function account(
  db: D1Database,
  uid: string,
): Promise<AdminAccount | null> {
  return db
    .prepare(
      "SELECT uid,email,points,monthly,renews_at,note,version FROM accounts WHERE uid=?",
    )
    .bind(uid)
    .first<AdminAccount>();
}
/**
 * Every signed-in person has an account row from their first request.
 *
 * Signing in with Google is the only way in, so there is nobody for an
 * administrator to create by hand: the row has to exist before anyone can be
 * given points, and it has to exist even when there is nothing to give, or the
 * administrator cannot see that the person is there at all.
 *
 * What a brand new account starts with is the `free_trial` switch and the two
 * new-account defaults beside it. Off means the row is created empty.
 */
export async function ensureAccount(
  db: D1Database,
  uid: string,
  email: string,
) {
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO accounts(uid,email,points,monthly,renews_at,updated_at)
    SELECT ?,?,
      COALESCE((SELECT CAST(value AS INTEGER) FROM settings WHERE key='default_initial' AND EXISTS(SELECT 1 FROM settings WHERE key='free_trial' AND value='true')),0),
      COALESCE((SELECT CAST(value AS INTEGER) FROM settings WHERE key='default_monthly' AND EXISTS(SELECT 1 FROM settings WHERE key='free_trial' AND value='true')),0),
      ?,?
    ON CONFLICT(uid) DO UPDATE SET email=excluded.email,version=accounts.version+1 WHERE accounts.email<>excluded.email`,
    )
    .bind(uid, email, nextRenewal(now), new Date().toISOString())
    .run();
}

/**
 * One lock owner, then one atomic D1 batch for fresh per-source charges and debit.
 *
 * A balance may never end a run below zero, but a batch whose estimate is larger
 * than what is left still runs: any balance above zero opens the door, the hold
 * may take the account below zero for the length of the run, and `settle` floors
 * the result at zero. The next batch is the one that is refused.
 */
export async function reserve(
  db: D1Database,
  uid: string,
  units: ChargeUnit[],
  halfRate: number,
): Promise<Reservation> {
  const attempt = crypto.randomUUID(),
    now = nowSeconds();
  const ids = units.map((unit) => unit.id);
  const limitIds = units.map((unit) => unit.limitId);
  const results = await db.batch([
    db
      .prepare(
        `UPDATE accounts SET version=version+1, points=points+(SELECT COALESCE(SUM(points),0) FROM charges WHERE uid=? AND created_at<=? AND attempt_id NOT LIKE 'settled:%' AND NOT EXISTS(SELECT 1 FROM pending_usage WHERE attempt_id=charges.attempt_id))
      WHERE uid=? AND EXISTS(SELECT 1 FROM charges WHERE uid=? AND created_at<=? AND attempt_id NOT LIKE 'settled:%' AND NOT EXISTS(SELECT 1 FROM pending_usage WHERE attempt_id=charges.attempt_id))`,
      )
      .bind(uid, now - 120, uid, uid, now - 120),
    db
      .prepare(
        "DELETE FROM charges WHERE uid=? AND ((created_at<=? AND attempt_id NOT LIKE 'settled:%') OR (created_at<=? AND attempt_id LIKE 'settled:%')) AND NOT EXISTS(SELECT 1 FROM pending_usage WHERE attempt_id=charges.attempt_id)",
      )
      .bind(uid, now - 120, now - 1800),
    db
      .prepare(
        `UPDATE accounts SET version=version+1, inflight_at=?,inflight_id=? WHERE uid=? AND (inflight_at IS NULL OR inflight_at<=?)
         AND NOT EXISTS(SELECT 1 FROM pending_usage WHERE uid=accounts.uid AND chargeable=1)`,
      )
      .bind(now, attempt, uid, now - 120),
    db.prepare("SELECT points FROM accounts WHERE uid=?").bind(uid),
  ]);
  const lock = results[2];
  const balance = (results[3].results as { points: number }[])[0];
  if (!lock.meta.changes) throw new BillingError(balance ? 409 : 402);
  // An account with nothing left does not start another batch. The balance is
  // read after the stale-charge reclaim above, so an abandoned hold cannot
  // masquerade as an empty account.
  if (balance.points <= 0) {
    await release(db, uid, attempt);
    throw new BillingError(402);
  }
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO attempt_limits(id,attempts,expires_at)
        SELECT DISTINCT value,1,? FROM json_each(?) WHERE true
        ON CONFLICT(id) DO UPDATE SET
          attempts=CASE WHEN expires_at<=? THEN 1 WHEN attempts<6 THEN attempts+1 ELSE NULL END,
          expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END`,
        )
        .bind(now + 1800, JSON.stringify(limitIds), now, now),
      db
        .prepare(
          `WITH fresh AS (
        SELECT DISTINCT value AS id FROM json_each(?) WHERE NOT EXISTS(SELECT 1 FROM charges WHERE id=json_each.value)
      ), ranked AS (SELECT id, row_number() OVER (ORDER BY id) AS n FROM fresh)
      INSERT INTO charges(id,uid,points,attempt_id,created_at)
      SELECT id,?,CAST((n*?+1)/2 AS INTEGER)-CAST(((n-1)*?+1)/2 AS INTEGER),?,? FROM ranked`,
        )
        .bind(JSON.stringify(ids), uid, halfRate, halfRate, attempt, now),
      // NULL deliberately violates NOT NULL: D1 rolls the inserts back as well.
      db
        .prepare(
          `UPDATE accounts SET version=version+1, points=CASE WHEN inflight_id=?
        THEN points-(SELECT COALESCE(SUM(points),0) FROM charges WHERE attempt_id=?) ELSE NULL END,
        updated_at=? WHERE uid=?`,
        )
        .bind(attempt, attempt, new Date().toISOString(), uid),
    ]);
    const rows = await db
      .prepare("SELECT id,points FROM charges WHERE attempt_id=?")
      .bind(attempt)
      .all<{ id: string; points: number }>();
    return { uid, attempt, charges: rows.results };
  } catch (reason) {
    await release(db, uid, attempt);
    if (
      reason instanceof Error &&
      reason.message.includes(
        "NOT NULL constraint failed: attempt_limits.attempts",
      )
    )
      throw new BillingError(429);
    if (
      reason instanceof Error &&
      reason.message.includes("NOT NULL constraint failed: accounts.points")
    )
      throw new BillingError(409);
    throw reason;
  }
}

export async function release(db: D1Database, uid: string, attempt: string) {
  await db
    .prepare(
      "UPDATE accounts SET version=version+1, inflight_at=NULL,inflight_id=NULL WHERE uid=? AND inflight_id=?",
    )
    .bind(uid, attempt)
    .run();
}

/**
 * Refund only this attempt's new charges; an idempotent retry cannot refund
 * earlier success.
 *
 * Releasing the hold and taking the real cost is one expression, and it is
 * floored at zero: a batch may cost more than the account had, and the account
 * lands on empty rather than in debt.
 */
export async function settle(
  db: D1Database,
  reservation: Reservation,
  refunds: ReadonlyArray<{ id: string }>,
  usage: Usage,
  settlement: Settlement = {},
) {
  const { uid, attempt } = reservation;
  const { cursor, status } = settlement;
  const refunded = new Set(refunds.map((refund) => refund.id));
  const successful = reservation.charges.filter(
    (charge) => !refunded.has(charge.id),
  );
  const charged = settlement.charged ?? successful.reduce((total, charge) => total + charge.points, 0);
  // Provider cost is recorded whether or not the user paid for it, so an
  // administrator sees what a failed or refunded run actually burned.
  const cost = settlement.cost === undefined ? charged : settlement.cost;
  const chargedCredits = reservation.charges.length ? charged : 0;
  const statements = [
    db.prepare(
      `INSERT INTO usage_log
       (id,uid,points,assessed_points,debit_verified,model,input,cached,cache_write,output,created_at,credits,status,kind,tier,units,usage_state,usage_parts)
       SELECT ?1,?2,
         CASE WHEN EXISTS(SELECT 1 FROM charges WHERE attempt_id=?1)
           THEN MIN(?3,MAX(0,points+(SELECT COALESCE(SUM(points),0) FROM charges WHERE attempt_id=?1)))
           ELSE 0 END,
         ?3,1,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16
       FROM accounts WHERE uid=?2
       ON CONFLICT(id) DO UPDATE SET
         points=excluded.points,assessed_points=excluded.assessed_points,debit_verified=1,
         input=excluded.input,cached=excluded.cached,cache_write=excluded.cache_write,output=excluded.output,
         credits=excluded.credits,status=excluded.status,usage_state=excluded.usage_state,usage_parts=excluded.usage_parts
       WHERE usage_log.usage_state='pending'`,
    ).bind(
      attempt, uid, chargedCredits, usage.model,
      usage.input ?? null, usage.cached ?? null, usage.cacheWrite ?? null,
      usage.output ?? null, nowSeconds(), cost, status ?? "complete",
      settlement.kind ?? "", settlement.tier ?? "", settlement.units ?? 0,
      settlement.usageState ?? "reported",
      JSON.stringify(settlement.usageParts ?? [{ ...usage, cursor }]),
    ),
    db
      .prepare(
        `UPDATE accounts SET version=version+1, points=MAX(0,points+
        (SELECT COALESCE(SUM(points),0) FROM charges WHERE attempt_id=?)-?),updated_at=?
        WHERE uid=? AND EXISTS(SELECT 1 FROM charges WHERE attempt_id=?)`,
      )
      .bind(attempt, chargedCredits, new Date().toISOString(), uid, attempt),
  ];
  for (const refund of refunds) {
    statements.push(
      db
        .prepare("DELETE FROM charges WHERE id=? AND attempt_id=?")
        .bind(refund.id, attempt),
    );
  }
  successful.forEach((charge, index) => {
    const points =
      Math.ceil(((index + 1) * chargedCredits) / successful.length) -
      Math.ceil((index * chargedCredits) / successful.length);
    statements.push(
      db
        .prepare("UPDATE charges SET points=? WHERE id=? AND attempt_id=?")
        .bind(points, charge.id, attempt),
    );
  });
  // Mark successful units as settled so repeated settlement cannot refund them again.
  statements.push(
    db
      .prepare("UPDATE charges SET attempt_id=?,created_at=? WHERE attempt_id=?")
      .bind(`settled:${attempt}`, nowSeconds(), attempt),
  );
  if (cursor)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO cursors(response_id,uid,created_at) VALUES(?,?,?)",
        )
        .bind(cursor, uid, nowSeconds()),
    );
  statements.push(
    db
      .prepare(
        "UPDATE accounts SET version=version+1, inflight_at=NULL,inflight_id=NULL WHERE uid=? AND inflight_id=?",
      )
      .bind(uid, attempt),
  );
  statements.push(db.prepare("DELETE FROM pending_usage WHERE attempt_id=?").bind(attempt));
  await db.batch(statements);
}

export async function ownsCursor(
  db: D1Database,
  uid: string,
  cursor: string,
): Promise<boolean> {
  return Boolean(
    await db
      .prepare(
        "SELECT 1 FROM cursors WHERE response_id=? AND uid=? AND created_at>?",
      )
      .bind(cursor, uid, nowSeconds() - 86400)
      .first(),
  );
}
export async function scheduledMaintenance(db: D1Database, now = nowSeconds()) {
  await db.batch([
    db.prepare("DELETE FROM attempt_limits WHERE expires_at<=?").bind(now),
    db
      .prepare(
        `UPDATE accounts SET version=version+1, points=points+COALESCE((SELECT SUM(points) FROM charges
      WHERE charges.uid=accounts.uid AND created_at<=? AND attempt_id NOT LIKE 'settled:%'
        AND NOT EXISTS(SELECT 1 FROM pending_usage WHERE attempt_id=charges.attempt_id)),0)
      WHERE EXISTS(SELECT 1 FROM charges WHERE charges.uid=accounts.uid AND created_at<=? AND attempt_id NOT LIKE 'settled:%'
        AND NOT EXISTS(SELECT 1 FROM pending_usage WHERE attempt_id=charges.attempt_id))`,
      )
      .bind(now - 120, now - 120),
    db
      .prepare(
        "DELETE FROM charges WHERE created_at<=? AND attempt_id NOT LIKE 'settled:%' AND NOT EXISTS(SELECT 1 FROM pending_usage WHERE attempt_id=charges.attempt_id)",
      )
      .bind(now - 120),
    db
      .prepare(
        "UPDATE accounts SET version=version+1, inflight_at=NULL,inflight_id=NULL WHERE inflight_at<=? AND NOT EXISTS(SELECT 1 FROM pending_usage WHERE attempt_id=accounts.inflight_id)",
      )
      .bind(now - 120),
  ]);
  const due = await db
    .prepare(
      "SELECT uid,renews_at FROM accounts WHERE monthly>0 AND renews_at<=?",
    )
    .bind(now)
    .all<{ uid: string; renews_at: number }>();
  const updates = due.results.map((row) => {
    let renewal = row.renews_at;
    do {
      renewal = nextRenewal(renewal);
    } while (renewal <= now);
    return db
      .prepare(
        "UPDATE accounts SET version=version+1, points=monthly,renews_at=?,updated_at=? WHERE uid=? AND renews_at<=? AND monthly>0 AND inflight_at IS NULL",
      )
      .bind(renewal, new Date(now * 1000).toISOString(), row.uid, now);
  });
  for (let at = 0; at < updates.length; at += 50)
    await db.batch(updates.slice(at, at + 50));
  await db.batch([
    db
      .prepare(
        "DELETE FROM charges WHERE created_at<? AND attempt_id LIKE 'settled:%'",
      )
      .bind(now - 1800),
    db.prepare("DELETE FROM cursors WHERE created_at<?").bind(now - 86400),
  ]);
}
