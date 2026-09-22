ALTER TABLE usage_log ADD COLUMN usage_state TEXT NOT NULL DEFAULT 'reported'
  CHECK(usage_state IN ('reported','pending','unavailable'));
UPDATE usage_log SET usage_state='unavailable' WHERE credits IS NULL;

-- Only billing metadata is retained: never prompts, generated text, or images.
CREATE TABLE pending_usage (
  attempt_id TEXT PRIMARY KEY REFERENCES usage_log(id),
  uid TEXT NOT NULL,
  response_id TEXT NOT NULL,
  model TEXT NOT NULL,
  chargeable INTEGER NOT NULL CHECK(chargeable IN (0,1)),
  successful_ids TEXT NOT NULL,
  checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX pending_usage_uid ON pending_usage(uid);
CREATE INDEX pending_usage_checked ON pending_usage(checked_at,attempt_id);
