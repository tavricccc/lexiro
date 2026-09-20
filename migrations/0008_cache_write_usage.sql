-- GPT-5.6 reports cache writes separately because they cost 1.25 times fresh
-- input while cache reads cost 0.1 times. Without this column the ledger
-- understated the first request that warmed a prompt prefix.
ALTER TABLE usage_log ADD COLUMN cache_write INTEGER;
