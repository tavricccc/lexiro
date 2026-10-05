import type { D1Database } from "@cloudflare/workers-types";

/** One receipt owns one slot; clearing it must not unlock its parallel sibling. */
export function releaseLeaseStatements(db: D1Database, uid: string, attempt: string) {
  return [
    db.prepare("DELETE FROM generation_leases WHERE attempt_id=? AND uid=?").bind(attempt, uid),
    db.prepare(`UPDATE accounts SET version=version+1,
      inflight_id=(SELECT session_id FROM generation_leases WHERE uid=? ORDER BY started_at LIMIT 1),
      inflight_at=(SELECT MAX(started_at) FROM generation_leases WHERE uid=?)
      WHERE uid=? AND inflight_id IS NOT NULL`).bind(uid, uid, uid),
  ];
}
