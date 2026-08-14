CREATE TABLE IF NOT EXISTS guardian_contacts (
  student_id TEXT PRIMARY KEY,
  guardian_1_name TEXT,
  guardian_1_phone TEXT,
  guardian_1_enabled INTEGER NOT NULL DEFAULT 0,
  guardian_2_name TEXT,
  guardian_2_phone TEXT,
  guardian_2_enabled INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teacher_whatsapp_settings (
  teacher_user_id TEXT PRIMARY KEY,
  phone TEXT,
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT NOT NULL DEFAULT '05:30',
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  absence_cutoff TEXT NOT NULL DEFAULT '09:00',
  active_start TEXT NOT NULL DEFAULT '05:00',
  active_end TEXT NOT NULL DEFAULT '17:00',
  max_batch INTEGER NOT NULL DEFAULT 25,
  retention_days INTEGER NOT NULL DEFAULT 30,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO whatsapp_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT UNIQUE NOT NULL,
  recipient_phone TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message_text TEXT NOT NULL,
  student_id TEXT,
  teacher_user_id TEXT,
  attendance_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT NOT NULL,
  claimed_at TEXT,
  claim_token TEXT,
  sent_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wa_outbox_claim ON whatsapp_outbox(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_wa_outbox_created ON whatsapp_outbox(created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_daily_stats (
  stat_date TEXT PRIMARY KEY,
  queued INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS whatsapp_job_runs (
  job_key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
