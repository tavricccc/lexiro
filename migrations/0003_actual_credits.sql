ALTER TABLE usage_log ADD COLUMN credits INTEGER;
INSERT INTO settings(key,value) VALUES ('trial_points','500');
INSERT INTO settings(key,value) VALUES ('default_monthly','1000');
