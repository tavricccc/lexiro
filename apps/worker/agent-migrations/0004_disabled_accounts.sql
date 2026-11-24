-- Accounts the operator has stopped. Every signed-in path checks this table,
-- rows are written by hand through the admin workflow, never by the API.
CREATE TABLE disabled_accounts (
  uid TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  disabled_at INTEGER NOT NULL
);
