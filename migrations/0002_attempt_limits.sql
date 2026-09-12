CREATE TABLE attempt_limits (
  id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX attempt_limits_expiry ON attempt_limits(expires_at);
