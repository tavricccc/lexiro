-- Older usage rows recorded the assessed cost, not necessarily the capped debit.
-- Preserve that history without pretending its actual debit can be reconstructed.
ALTER TABLE usage_log ADD COLUMN assessed_points INTEGER;
ALTER TABLE usage_log ADD COLUMN debit_verified INTEGER NOT NULL DEFAULT 0 CHECK(debit_verified IN (0,1));
