ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN archived_at TEXT;
ALTER TABLE users ADD COLUMN archived_by TEXT;

UPDATE users
SET role = 'super_admin', jabatan = 'Super Administrator', status = 'active'
WHERE email = 'admin@smksplusatthahirin.sch.id';

CREATE TABLE IF NOT EXISTS user_audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  target_name TEXT,
  before_value TEXT,
  after_value TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_audit_created ON user_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
