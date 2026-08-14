CREATE TABLE IF NOT EXISTS api_rate_limits (
  key TEXT PRIMARY KEY,
  window_started INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON api_rate_limits(window_started);
