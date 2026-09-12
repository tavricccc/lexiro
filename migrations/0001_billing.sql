CREATE TABLE accounts (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  monthly INTEGER NOT NULL DEFAULT 1000 CHECK(monthly >= 0),
  renews_at INTEGER NOT NULL,
  inflight_at INTEGER,
  inflight_id TEXT,
  note TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO settings VALUES ('free_trial', 'false');
CREATE TABLE charges (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES accounts(uid),
  points INTEGER NOT NULL CHECK(points >= 0),
  attempt_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX charges_attempt ON charges(attempt_id);
CREATE INDEX charges_created ON charges(created_at);
CREATE TABLE usage_log (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  points INTEGER NOT NULL,
  model TEXT NOT NULL,
  input INTEGER,
  cached INTEGER,
  output INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE cursors (
  response_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX cursors_created ON cursors(created_at);
