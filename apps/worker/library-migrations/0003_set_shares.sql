-- Share links work like a shared document: the link names the owner's set,
-- and every read returns that set's latest synced copy. One link per set, so
-- sharing again hands back the same address until the owner revokes it.
CREATE TABLE set_shares (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  set_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(owner_uid,set_id)
);
