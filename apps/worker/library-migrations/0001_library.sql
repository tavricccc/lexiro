CREATE TABLE cloud_accounts (
  uid TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  blob_revision INTEGER NOT NULL DEFAULT 0,
  changed_by TEXT NOT NULL DEFAULT '',
  blob_changed_by TEXT NOT NULL DEFAULT '',
  write_token TEXT NOT NULL DEFAULT ''
);
CREATE TABLE cloud_records (
  uid TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('folder','set','membership','word','question')),
  record_key TEXT NOT NULL,
  payload TEXT,
  deleted INTEGER NOT NULL CHECK(deleted IN (0,1)),
  updated_at TEXT NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY(uid,id),
  FOREIGN KEY(uid) REFERENCES cloud_accounts(uid)
);
CREATE INDEX cloud_records_feed ON cloud_records(uid,seq,id);
CREATE INDEX cloud_records_kind ON cloud_records(uid,kind,deleted);
CREATE INDEX cloud_records_key ON cloud_records(uid,kind,record_key,deleted);
CREATE TABLE cloud_memberships (
  uid TEXT NOT NULL,
  set_id TEXT NOT NULL,
  word_key TEXT NOT NULL,
  sense_ids TEXT NOT NULL,
  PRIMARY KEY(uid,set_id,word_key)
);
CREATE INDEX cloud_memberships_word ON cloud_memberships(uid,word_key,set_id);
CREATE TABLE cloud_question_sources (
  uid TEXT NOT NULL,
  question_id TEXT NOT NULL,
  word_key TEXT NOT NULL,
  PRIMARY KEY(uid,question_id,word_key)
);
CREATE INDEX cloud_question_sources_word ON cloud_question_sources(uid,word_key,question_id);
CREATE TABLE cloud_blobs (
  uid TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('progress','stats','preferences')),
  data TEXT NOT NULL,
  PRIMARY KEY(uid,kind)
);
CREATE TABLE cloud_operations (
  uid TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(uid,operation_id)
);
