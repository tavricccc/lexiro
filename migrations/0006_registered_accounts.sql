-- Google sign-in is the only way in, so an account row belongs to whoever signs
-- in rather than to whoever an administrator typed a uid for. One number is
-- enough for what a new account starts with, so `trial_points` gives way to
-- `default_initial`.
DELETE FROM settings WHERE key='trial_points';
