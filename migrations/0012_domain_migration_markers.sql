CREATE TABLE IF NOT EXISTS domain_migrations (
  key TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
