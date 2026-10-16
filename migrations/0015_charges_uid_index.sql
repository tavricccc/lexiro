-- Billing lookups always filter by uid, so index the charges ledger per account.
CREATE INDEX IF NOT EXISTS charges_uid_created ON charges(uid, created_at);
