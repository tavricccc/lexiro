import type { D1Database } from "@cloudflare/workers-types";
import type { AdminAccount } from "@lexiro/ai-contract";

export class BillingError extends Error {
  constructor(public status: 402 | 409 | 429) {
    super(status === 402 ? "insufficient_points" : status === 429 ? "retry_limit" : "generation_in_progress");
  }
}
export interface Reservation {
  uid: string;
  attempt: string;
  charges: { id: string; points: number }[];
}
export interface Usage {
  model: string;
  input?: number;
  cached?: number;
  output?: number;
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
      "SELECT uid,email,points,monthly,renews_at,note FROM accounts WHERE uid=?",
    )
    .bind(uid)
    .first<AdminAccount>();
}
export async function ensureTrial(db: D1Database, uid: string, email: string) {
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT OR IGNORE INTO accounts(uid,email,points,monthly,renews_at,updated_at)
    SELECT ?,?,500,0,?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key='free_trial' AND value='true')`,
    )
    .bind(uid, email, nextRenewal(now), new Date().toISOString())
    .run();
}

/** One lock owner, then one atomic D1 batch for fresh per-source charges and debit. */
export async function reserve(
  db: D1Database,
  uid: string,
  ids: string[],
  halfRate: number,
  overdraft: number,
): Promise<Reservation> {
  const attempt = crypto.randomUUID(),
    now = nowSeconds();
  const results = await db.batch([
    db
      .prepare(
        `UPDATE accounts SET points=points+(SELECT COALESCE(SUM(points),0) FROM charges WHERE uid=? AND created_at<=? AND attempt_id NOT LIKE 'settled:%')
      WHERE uid=? AND EXISTS(SELECT 1 FROM charges WHERE uid=? AND created_at<=? AND attempt_id NOT LIKE 'settled:%')`,
      )
      .bind(uid, now - 120, uid, uid, now - 120),
    db
      .prepare(
        "DELETE FROM charges WHERE uid=? AND ((created_at<=? AND attempt_id NOT LIKE 'settled:%') OR (created_at<=? AND attempt_id LIKE 'settled:%'))",
      )
      .bind(uid, now - 120, now - 1800),
    db
      .prepare(
        `UPDATE accounts SET inflight_at=?,inflight_id=? WHERE uid=? AND (inflight_at IS NULL OR inflight_at<=?)`,
      )
      .bind(now, attempt, uid, now - 120),
  ]);
  const lock = results[2];
  if (!lock.meta.changes)
    throw new BillingError((await account(db, uid)) ? 409 : 402);
  try {
    await db.batch([
      db.prepare(`INSERT INTO attempt_limits(id,attempts,expires_at)
        SELECT DISTINCT value,1,? FROM json_each(?) WHERE true
        ON CONFLICT(id) DO UPDATE SET
          attempts=CASE WHEN expires_at<=? THEN 1 WHEN attempts<6 THEN attempts+1 ELSE NULL END,
          expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END`)
        .bind(now + 1800, JSON.stringify(ids), now, now),
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
          `UPDATE accounts SET points=CASE
        WHEN inflight_id=? AND points-(SELECT COALESCE(SUM(points),0) FROM charges WHERE attempt_id=?)>=-?
        THEN points-(SELECT COALESCE(SUM(points),0) FROM charges WHERE attempt_id=?) ELSE NULL END,
        updated_at=? WHERE uid=?`,
        )
        .bind(
          attempt,
          attempt,
          overdraft,
          attempt,
          new Date().toISOString(),
          uid,
        ),
    ]);
    const rows = await db
      .prepare("SELECT id,points FROM charges WHERE attempt_id=?")
      .bind(attempt)
      .all<{ id: string; points: number }>();
    return { uid, attempt, charges: rows.results };
  } catch (reason) {
    await release(db, uid, attempt);
    if (reason instanceof Error && reason.message.includes("NOT NULL constraint failed: attempt_limits.attempts")) throw new BillingError(429);
    if (
      reason instanceof Error &&
      reason.message.includes("NOT NULL constraint failed: accounts.points")
    )
      throw new BillingError(402);
    throw reason;
  }
}

export async function release(db: D1Database, uid: string, attempt: string) {
  await db
    .prepare(
      "UPDATE accounts SET inflight_at=NULL,inflight_id=NULL WHERE uid=? AND inflight_id=?",
    )
    .bind(uid, attempt)
    .run();
}

/** Refund only this attempt's new charges; an idempotent retry cannot refund earlier success. */
export async function settle(
  db: D1Database,
  reservation: Reservation,
  refunds: { id: string; points: number }[],
  usage: Usage,
  cursor?: string,
) {
  const { uid, attempt } = reservation;
  const statements = [];
  for (const refund of refunds) {
    statements.push(
      db
        .prepare(
          `UPDATE accounts SET points=points+COALESCE(
      (SELECT MIN(points,?) FROM charges WHERE id=? AND attempt_id=?),0) WHERE uid=?`,
        )
        .bind(refund.points, refund.id, attempt, uid),
    );
    statements.push(
      db
        .prepare(
          "UPDATE charges SET points=MAX(0,points-?) WHERE id=? AND attempt_id=?",
        )
        .bind(refund.points, refund.id, attempt),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT OR IGNORE INTO usage_log(id,uid,points,model,input,cached,output,created_at)
    SELECT ?,?,COALESCE(SUM(points),0),?,?,?,?,? FROM charges WHERE attempt_id=?`,
      )
      .bind(
        attempt,
        uid,
        usage.model,
        usage.input ?? null,
        usage.cached ?? null,
        usage.output ?? null,
        nowSeconds(),
        attempt,
      ),
  );
  // Zero-cost failed units are removed so a later repair pays only if it produces them.
  statements.push(
    db
      .prepare("DELETE FROM charges WHERE attempt_id=? AND points=0")
      .bind(attempt),
  );
  // Mark successful units as settled so repeated settlement cannot refund them again.
  statements.push(
    db
      .prepare("UPDATE charges SET attempt_id=? WHERE attempt_id=?")
      .bind(`settled:${attempt}`, attempt),
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
        "UPDATE accounts SET inflight_at=NULL,inflight_id=NULL WHERE uid=? AND inflight_id=?",
      )
      .bind(uid, attempt),
  );
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
        `UPDATE accounts SET points=points+COALESCE((SELECT SUM(points) FROM charges
      WHERE charges.uid=accounts.uid AND created_at<=? AND attempt_id NOT LIKE 'settled:%'),0)
      WHERE EXISTS(SELECT 1 FROM charges WHERE charges.uid=accounts.uid AND created_at<=? AND attempt_id NOT LIKE 'settled:%')`,
      )
      .bind(now - 120, now - 120),
    db
      .prepare(
        "DELETE FROM charges WHERE created_at<=? AND attempt_id NOT LIKE 'settled:%'",
      )
      .bind(now - 120),
    db
      .prepare(
        "UPDATE accounts SET inflight_at=NULL,inflight_id=NULL WHERE inflight_at<=?",
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
        "UPDATE accounts SET points=monthly,renews_at=?,updated_at=? WHERE uid=? AND renews_at<=? AND monthly>0 AND inflight_at IS NULL",
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
