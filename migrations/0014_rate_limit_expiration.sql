ALTER TABLE api_rate_limits ADD COLUMN window_expires INTEGER NOT NULL DEFAULT 0;

-- Existing counters are safely expired once because their window duration was not persisted.
UPDATE api_rate_limits SET window_expires = window_started;

DROP INDEX IF EXISTS idx_api_rate_limits_window;
CREATE INDEX idx_api_rate_limits_expiration ON api_rate_limits(window_expires);
