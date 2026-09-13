-- Cost per unit is the number the point rates are calibrated against, and the
-- ledger could not produce it: a run recorded its tokens but not what kind of
-- work it was, which tier ran it, or how many billable units it covered.
ALTER TABLE usage_log ADD COLUMN kind TEXT NOT NULL DEFAULT '';
ALTER TABLE usage_log ADD COLUMN tier TEXT NOT NULL DEFAULT '';
ALTER TABLE usage_log ADD COLUMN units INTEGER NOT NULL DEFAULT 0;
