-- Learning progress and statistics were removed from the app. Their rows are
-- deleted, and the kind check is rebuilt for preferences and the cross-device
-- practice session.
CREATE TABLE cloud_blobs_next (
  uid TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('preferences','practice')),
  data TEXT NOT NULL,
  PRIMARY KEY(uid,kind)
);
INSERT INTO cloud_blobs_next(uid,kind,data)
SELECT uid,kind,data FROM cloud_blobs WHERE kind='preferences';
DROP TABLE cloud_blobs;
ALTER TABLE cloud_blobs_next RENAME TO cloud_blobs;
