CREATE TABLE IF NOT EXISTS external_integrations (
  integration_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  emergency_pause INTEGER NOT NULL DEFAULT 1,
  rollout_mode TEXT NOT NULL DEFAULT 'off' CHECK (rollout_mode IN ('off', 'canary', 'all')),
  allowlist_json TEXT NOT NULL DEFAULT '[]',
  last_heartbeat_at TEXT,
  gateway_status TEXT NOT NULL DEFAULT 'never_seen',
  gateway_version TEXT,
  health_json TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO external_integrations (integration_key)
VALUES ('whatsapp_web');

CREATE TABLE IF NOT EXISTS whatsapp_delivery_meta (
  outbox_id TEXT PRIMARY KEY,
  delivery_state TEXT NOT NULL,
  provider_message_id TEXT,
  send_started_at TEXT,
  provider_accepted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (outbox_id) REFERENCES whatsapp_outbox(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_delivery_state
ON whatsapp_delivery_meta(delivery_state, updated_at);

CREATE TABLE IF NOT EXISTS whatsapp_consent_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  provenance TEXT NOT NULL,
  recorded_by TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wa_consent_student
ON whatsapp_consent_events(student_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_teacher_reminders (
  teacher_user_id TEXT NOT NULL,
  reminder_date TEXT NOT NULL,
  outbox_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (teacher_user_id, reminder_date)
);

CREATE TABLE IF NOT EXISTS whatsapp_event_revisions (
  event_group TEXT PRIMARY KEY,
  last_fingerprint TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_reconciliation_events (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL,
  resolution TEXT NOT NULL CHECK (resolution IN ('sent', 'failed')),
  note TEXT NOT NULL,
  resolved_by TEXT NOT NULL,
  resolved_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (outbox_id) REFERENCES whatsapp_outbox(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_reconciliation_outbox
ON whatsapp_reconciliation_events(outbox_id, resolved_at DESC);
