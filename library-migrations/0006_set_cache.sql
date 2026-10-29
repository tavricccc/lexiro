-- A whole set snapshot in one row, valid only while the account revision
-- still equals revision. D1 bills reads by row, so an Agent edit to a
-- 1000-word set reads this row instead of thousands. Agent commits rewrite it
-- in the same batch, and any other commit bumps the revision and so retires it.
CREATE TABLE cloud_set_cache (
  uid TEXT NOT NULL,
  set_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(uid,set_id)
);
