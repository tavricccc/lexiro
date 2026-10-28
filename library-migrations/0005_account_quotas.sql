-- Per-account limits that keep one account from spending the shared D1 quota.
-- quota_day and quota_writes count the records and documents written on the UTC
-- day, and stored_bytes is the payload size held, kept up to date by each commit.
ALTER TABLE cloud_accounts ADD COLUMN quota_day TEXT NOT NULL DEFAULT '';
ALTER TABLE cloud_accounts ADD COLUMN quota_writes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cloud_accounts ADD COLUMN stored_bytes INTEGER NOT NULL DEFAULT 0;
UPDATE cloud_accounts SET stored_bytes = (
  SELECT COALESCE(SUM(length(payload)), 0) FROM cloud_records WHERE cloud_records.uid = cloud_accounts.uid
);
