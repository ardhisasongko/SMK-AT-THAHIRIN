-- Audit trail: setiap perubahan presensi dicatat di tabel ini.
-- Admin bisa melihat riwayat perubahan (log) melalui endpoint GET /api/data/presensi_log.

CREATE TABLE IF NOT EXISTS presensi_log (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  siswa_id TEXT NOT NULL,
  siswa_name TEXT NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by_name TEXT NOT NULL,
  changed_by_role TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_presensi_log_tanggal ON presensi_log(tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_log_siswa ON presensi_log(siswa_id);
CREATE INDEX IF NOT EXISTS idx_presensi_log_changed_at ON presensi_log(changed_at);