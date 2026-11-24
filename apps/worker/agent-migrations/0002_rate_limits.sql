-- Fixed-window rate limit counters for the unauthenticated Agent endpoints
-- /authorize and /oauth/register. One row per endpoint+IP and 60 second
-- window, and the Agent Cron deletes rows older than the reused 7 day cutoff.
CREATE TABLE agent_rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
