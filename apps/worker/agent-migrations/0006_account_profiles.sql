-- Who an account is, for the operator's screen: the email and display name its
-- last Firebase token carried. Written by the API on sign-in, never by hand,
-- and removed with the account.
CREATE TABLE account_profiles (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  seen_at INTEGER NOT NULL
);
CREATE INDEX account_profiles_email ON account_profiles(email);
