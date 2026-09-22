CREATE INDEX usage_log_created_id ON usage_log(created_at DESC,id DESC);
CREATE INDEX accounts_email_uid ON accounts(email,uid);
