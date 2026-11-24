-- Each device's own learning history (answer counts, familiarity, daily goal).
-- One row per device, written only by that device and merged by the clients.
-- It is a separate table so older clients, which pull cloud_records and
-- cloud_blobs, never meet a kind they do not know.
CREATE TABLE cloud_learning (
  uid TEXT NOT NULL,
  device_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(uid,device_id)
);
CREATE INDEX cloud_learning_updated ON cloud_learning(uid,updated_at);
