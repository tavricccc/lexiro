-- Receipts older than the retention window are removed by the Agent Cron.
-- Index created_at so that sweep does not scan the whole table.
CREATE INDEX IF NOT EXISTS cloud_operations_created ON cloud_operations(created_at);
