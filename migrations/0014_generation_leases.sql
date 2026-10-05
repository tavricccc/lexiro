CREATE TABLE generation_leases (
  attempt_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES accounts(uid),
  session_id TEXT NOT NULL,
  started_at INTEGER NOT NULL
);
CREATE INDEX generation_leases_uid ON generation_leases(uid, started_at);
INSERT INTO generation_leases(attempt_id,uid,session_id,started_at)
SELECT inflight_id,uid,inflight_id,inflight_at FROM accounts WHERE inflight_id IS NOT NULL;
