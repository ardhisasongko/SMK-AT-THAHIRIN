-- Jadwal harian CBT: jam buka/tutup per hari (WIB) + auto-save jawaban
ALTER TABLE cbt_exams ADD COLUMN open_time TEXT;
ALTER TABLE cbt_exams ADD COLUMN close_time TEXT;

CREATE TABLE IF NOT EXISTS cbt_attempt_answers (
  attempt_id TEXT PRIMARY KEY,
  answers_json TEXT NOT NULL DEFAULT '{}',
  doubtful_json TEXT NOT NULL DEFAULT '{}',
  saved_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (attempt_id) REFERENCES cbt_attempts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cbt_attempt_answers_attempt ON cbt_attempt_answers(attempt_id);