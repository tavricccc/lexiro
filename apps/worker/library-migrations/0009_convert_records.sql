-- One-time conversion of the record-sync library (cloud_records and its
-- indexes) into the relational tables of 0008. Word ids keep the old word
-- keys and sense ids stay as they were, so learning tallies still match.
-- The old tables are left in place; a later migration drops them.

INSERT OR IGNORE INTO accounts(uid,revision,quota_day,quota_writes,created_at)
SELECT uid, revision + 1, quota_day, quota_writes, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM cloud_accounts;

INSERT OR IGNORE INTO accounts(uid,created_at)
SELECT DISTINCT uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM cloud_learning;

INSERT OR IGNORE INTO folders(uid,id,name,parent_id,ord,updated_at)
SELECT uid, record_key,
  json_extract(payload,'$.name'),
  NULLIF(NULLIF(json_extract(payload,'$.parentId'),'__uncategorized__'),''),
  COALESCE(json_extract(payload,'$.order'),0),
  COALESCE(json_extract(payload,'$.updatedAt'),updated_at)
FROM cloud_records
WHERE kind='folder' AND deleted=0 AND payload IS NOT NULL AND record_key<>'__uncategorized__';

UPDATE folders SET parent_id=NULL
WHERE parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM folders p WHERE p.uid=folders.uid AND p.id=folders.parent_id);

INSERT OR IGNORE INTO sets(uid,id,folder_id,name,hue,icon,ord,created_at,updated_at)
SELECT uid, record_key,
  NULLIF(NULLIF(json_extract(payload,'$.folderId'),'__uncategorized__'),''),
  json_extract(payload,'$.setName'),
  COALESCE(json_extract(payload,'$.hue'),'mint'),
  COALESCE(json_extract(payload,'$.icon'),'books'),
  json_extract(payload,'$.order'),
  COALESCE(json_extract(payload,'$.createdAt'),updated_at),
  COALESCE(json_extract(payload,'$.updatedAt'),updated_at)
FROM cloud_records
WHERE kind='set' AND deleted=0 AND payload IS NOT NULL;

UPDATE sets SET folder_id=NULL
WHERE folder_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM folders f WHERE f.uid=sets.uid AND f.id=sets.folder_id);

-- A word goes to the set whose membership lists it, with only the senses
-- that membership lists.
INSERT OR IGNORE INTO words(uid,id,set_id,word,norm,starred,senses,updated_at)
SELECT r.uid, r.record_key, m.set_id,
  trim(json_extract(r.payload,'$.word')),
  lower(trim(json_extract(r.payload,'$.word'))),
  COALESCE(json_extract(r.payload,'$.starred'),0),
  (SELECT json_group_array(json(json_patch(
      json_object(
        'id', json_extract(s.value,'$.id'),
        'pos', json_extract(s.value,'$.pos'),
        'meaning', json_extract(s.value,'$.meaningZh'),
        'examples', json(COALESCE(json_extract(s.value,'$.examples'),'[]')),
        'supplementary', json(CASE WHEN json_extract(s.value,'$.supplementary') THEN 'true' ELSE 'false' END)),
      json_object('description', NULLIF(json_extract(s.value,'$.description'),'')))))
   FROM json_each(r.payload,'$.senses') s
   WHERE json_extract(s.value,'$.id') IN (SELECT value FROM json_each(m.sense_ids))),
  COALESCE(json_extract(r.payload,'$.updatedAt'),r.updated_at)
FROM cloud_records r
JOIN cloud_memberships m ON m.uid=r.uid AND m.word_key=r.record_key
JOIN sets ON sets.uid=m.uid AND sets.id=m.set_id
WHERE r.kind='word' AND r.deleted=0 AND r.payload IS NOT NULL;

DELETE FROM words WHERE json_array_length(senses)=0;

-- A question goes to the set of the word it was written from.
INSERT OR IGNORE INTO questions(uid,id,set_id,kind,difficulty,body,created_at,updated_at)
SELECT r.uid, r.record_key, w.set_id,
  CASE json_extract(r.payload,'$.kind') WHEN 'multipleChoice' THEN 'vocabulary' ELSE json_extract(r.payload,'$.format') END,
  json_extract(r.payload,'$.difficulty'),
  CASE json_extract(r.payload,'$.kind')
    WHEN 'multipleChoice' THEN json_patch(
      json_object(
        'prompt', json_extract(r.payload,'$.prompt'),
        'options', json(json_extract(r.payload,'$.options')),
        'answer', json_extract(r.payload,'$.answerIndex'),
        'senseId', json_extract(r.payload,'$.senseId')),
      json_object(
        'explanation', NULLIF(json_extract(r.payload,'$.explanation'),''),
        'whyWrong', json(json_extract(r.payload,'$.whyWrong'))))
    ELSE json_patch(
      json_object(
        'passage', json_extract(r.payload,'$.passage'),
        'items', (SELECT json_group_array(json(json_patch(
            json_object(
              'id', json_extract(c.value,'$.id'),
              'answer', json_extract(c.value,'$.answerIndex'),
              'senseId', json_extract(c.value,'$.senseId')),
            json_object(
              'blank', json_extract(c.value,'$.blank'),
              'prompt', CASE WHEN json_extract(r.payload,'$.format')='reading' THEN json_extract(c.value,'$.prompt') END,
              'options', CASE WHEN COALESCE(json_array_length(r.payload,'$.optionBank'),0)=0 THEN json(json_extract(c.value,'$.options')) END,
              'explanation', NULLIF(json_extract(c.value,'$.explanation'),''),
              'whyWrong', json(json_extract(c.value,'$.whyWrong'))))))
          FROM json_each(r.payload,'$.questions') c)),
      json_object(
        'title', NULLIF(json_extract(r.payload,'$.title'),''),
        'bank', CASE WHEN COALESCE(json_array_length(r.payload,'$.optionBank'),0)>0 THEN json(json_extract(r.payload,'$.optionBank')) END,
        'explanation', NULLIF(json_extract(r.payload,'$.explanation'),'')))
  END,
  COALESCE(json_extract(r.payload,'$.createdAt'),r.updated_at),
  COALESCE(json_extract(r.payload,'$.updatedAt'),r.updated_at)
FROM cloud_records r
JOIN words w ON w.uid=r.uid AND w.id=COALESCE(json_extract(r.payload,'$.wordKey'),json_extract(r.payload,'$.questions[0].wordKey'))
WHERE r.kind='question' AND r.deleted=0 AND r.payload IS NOT NULL
  AND COALESCE(json_extract(r.payload,'$.questionStyle'),'vocabulary')<>'grammar';

INSERT OR IGNORE INTO question_senses(uid,question_id,sense_id)
SELECT uid, id, json_extract(body,'$.senseId') FROM questions WHERE kind='vocabulary'
UNION
SELECT q.uid, q.id, json_extract(i.value,'$.senseId') FROM questions q, json_each(q.body,'$.items') i WHERE q.kind<>'vocabulary';

-- A question about a sense its set no longer has would fail in practice.
DELETE FROM questions WHERE EXISTS (
  SELECT 1 FROM question_senses qs WHERE qs.uid=questions.uid AND qs.question_id=questions.id AND NOT EXISTS (
    SELECT 1 FROM words w, json_each(w.senses) s
    WHERE w.uid=qs.uid AND w.set_id=questions.set_id AND json_extract(s.value,'$.id')=qs.sense_id));

DELETE FROM question_senses WHERE NOT EXISTS (
  SELECT 1 FROM questions q WHERE q.uid=question_senses.uid AND q.id=question_senses.question_id);

UPDATE sets SET
  word_count=(SELECT COUNT(*) FROM words w WHERE w.uid=sets.uid AND w.set_id=sets.id),
  question_count=(SELECT COUNT(*) FROM questions q WHERE q.uid=sets.uid AND q.set_id=sets.id);

-- Learning was kept per device; the account now holds the sum.
INSERT OR IGNORE INTO learning_days(uid,day,answered,correct)
SELECT l.uid, d.key, SUM(json_extract(d.value,'$.answered')), SUM(json_extract(d.value,'$.correct'))
FROM cloud_learning l, json_each(l.data,'$.days') d GROUP BY l.uid, d.key;

INSERT OR IGNORE INTO learning_tasks(uid,task,answered,correct)
SELECT l.uid, k.key, SUM(json_extract(k.value,'$.answered')), SUM(json_extract(k.value,'$.correct'))
FROM cloud_learning l, json_each(l.data,'$.kinds') k GROUP BY l.uid, k.key;

INSERT OR IGNORE INTO learning_senses(uid,sense_id,word_id,level,answered,correct,last_day)
SELECT l.uid, s.key, MAX(json_extract(s.value,'$.wordKey')), MAX(json_extract(s.value,'$.level')),
  SUM(json_extract(s.value,'$.answered')), SUM(json_extract(s.value,'$.correct')), MAX(json_extract(s.value,'$.lastDay'))
FROM cloud_learning l, json_each(l.data,'$.senses') s GROUP BY l.uid, s.key;

UPDATE accounts SET goal=(
  SELECT json_extract(l.data,'$.goal') FROM cloud_learning l WHERE l.uid=accounts.uid
  ORDER BY COALESCE(json_extract(l.data,'$.goalUpdatedAt'),'') DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM cloud_learning l WHERE l.uid=accounts.uid AND json_extract(l.data,'$.goal') IN (10,20,30));

INSERT OR IGNORE INTO shares(id,uid,set_id,created_at)
SELECT s.id, s.owner_uid, s.set_id, s.created_at FROM set_shares s
JOIN sets ON sets.uid=s.owner_uid AND sets.id=s.set_id;
