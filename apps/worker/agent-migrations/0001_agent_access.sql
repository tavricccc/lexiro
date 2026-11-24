CREATE TABLE agent_links (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  uid TEXT NOT NULL,
  set_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX agent_links_owner ON agent_links(uid, set_id, expires_at);
CREATE TABLE agent_authorizations (
  id TEXT PRIMARY KEY,
  request_json TEXT NOT NULL,
  client_name TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
