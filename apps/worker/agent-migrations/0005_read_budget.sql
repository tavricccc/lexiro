-- One row per account: the D1 rows its requests read on one UTC day. The
-- first request of a new day restarts the count in place.
CREATE TABLE account_reads (
  uid TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  rows INTEGER NOT NULL
);

-- Switches the operator workflows set, such as agent_paused while the
-- account-wide D1 read quota runs low.
CREATE TABLE service_flags (
  name TEXT PRIMARY KEY,
  updated_at INTEGER NOT NULL
);
