-- A run that never reached a terminal event still burned provider tokens. The
-- ledger now records what every run cost and how it ended, separately from the
-- points the user was charged for it.
ALTER TABLE usage_log ADD COLUMN status TEXT NOT NULL DEFAULT 'complete';
CREATE INDEX usage_log_uid ON usage_log(uid, created_at);
