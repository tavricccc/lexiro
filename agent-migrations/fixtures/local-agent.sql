CREATE TABLE local_agent_sets(uid TEXT NOT NULL,set_id TEXT NOT NULL,snapshot TEXT,revision TEXT NOT NULL,PRIMARY KEY(uid,set_id));
CREATE TABLE local_agent_operations(uid TEXT NOT NULL,id TEXT NOT NULL,input_hash TEXT NOT NULL,receipt TEXT NOT NULL,PRIMARY KEY(uid,id));
