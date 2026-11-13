-- The library as plain tables. D1 is the only source of truth; clients cache
-- reads and send single-resource writes. accounts.revision rises with every
-- write so a client can tell, from one row, whether its cache is stale.
CREATE TABLE accounts (
  uid TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  quota_day TEXT NOT NULL DEFAULT '',
  quota_writes INTEGER NOT NULL DEFAULT 0,
  goal INTEGER NOT NULL DEFAULT 20,
  prefs TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE folders (
  uid TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  ord REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(uid,id)
);
CREATE TABLE sets (
  uid TEXT NOT NULL,
  id TEXT NOT NULL,
  folder_id TEXT,
  name TEXT NOT NULL,
  hue TEXT NOT NULL DEFAULT 'mint',
  icon TEXT NOT NULL DEFAULT 'books',
  ord REAL,
  word_count INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(uid,id)
);
-- A word belongs to one set; norm keeps one entry per spelling in a set.
-- senses is a JSON array of {id,pos,meaning,examples,description?,supplementary}.
CREATE TABLE words (
  uid TEXT NOT NULL,
  id TEXT NOT NULL,
  set_id TEXT NOT NULL,
  word TEXT NOT NULL,
  norm TEXT NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0,
  senses TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(uid,id),
  UNIQUE(uid,set_id,norm)
);
-- body is the question without id, set_id, kind and timestamps.
CREATE TABLE questions (
  uid TEXT NOT NULL,
  id TEXT NOT NULL,
  set_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(uid,id)
);
CREATE INDEX questions_set ON questions(uid,set_id);
-- Which senses a question practises, so removing a sense finds its questions.
CREATE TABLE question_senses (
  uid TEXT NOT NULL,
  question_id TEXT NOT NULL,
  sense_id TEXT NOT NULL,
  PRIMARY KEY(uid,question_id,sense_id)
);
CREATE INDEX question_senses_sense ON question_senses(uid,sense_id);
CREATE TABLE learning_senses (
  uid TEXT NOT NULL,
  sense_id TEXT NOT NULL,
  word_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  answered INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  last_day TEXT NOT NULL,
  PRIMARY KEY(uid,sense_id)
);
CREATE TABLE learning_days (
  uid TEXT NOT NULL,
  day TEXT NOT NULL,
  answered INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  PRIMARY KEY(uid,day)
);
CREATE TABLE learning_tasks (
  uid TEXT NOT NULL,
  task TEXT NOT NULL,
  answered INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  PRIMARY KEY(uid,task)
);
-- Idempotency: a write or answer batch carrying an id already here is a resend.
CREATE TABLE receipts (
  uid TEXT NOT NULL,
  id TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(uid,id)
);
CREATE INDEX receipts_created ON receipts(created_at);
CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  set_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(uid,set_id)
);
