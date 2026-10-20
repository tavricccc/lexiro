-- One-time codes that hand a Google sign-in from the web app to the native
-- app. A row lives at most 60 seconds, is deleted when redeemed, and the Agent
-- Cron removes any that expired unredeemed.
CREATE TABLE app_auth_codes (
  code_hash TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  uid TEXT NOT NULL,
  google_id_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
