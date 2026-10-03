-- One operation may use separate drafting and reviewing provider responses.
-- Store billing metadata only, with one pending parent reservation.
ALTER TABLE usage_log ADD COLUMN usage_parts TEXT NOT NULL DEFAULT '[]';
UPDATE usage_log SET usage_parts=json_array(json_object(
  'model',model,'input',input,'output',output,'cached',cached,'cacheWrite',cache_write));
ALTER TABLE pending_usage ADD COLUMN usage_parts TEXT NOT NULL DEFAULT '[]';
UPDATE pending_usage SET usage_parts=json_array(json_object('model',model,'cursor',response_id));
