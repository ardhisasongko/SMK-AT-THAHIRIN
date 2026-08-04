-- Migrasi awal Cloudflare D1 untuk SMKS PLUS AT THAHIRIN
-- Model data: setiap koleksi aplikasi disimpan sebagai satu baris JSON.
-- Koleksi: users, kelas, siswa, presensi, modulAjar, forumTopics, notifications, cbtExams, cbtSubmissions

CREATE TABLE IF NOT EXISTS app_data (
  key TEXT PRIMARY KEY,      -- nama koleksi, mis. 'users', 'kelas', ...
  value TEXT NOT NULL,       -- JSON blob dari seluruh array data koleksi
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index bantuan (opsional)
CREATE INDEX IF NOT EXISTS idx_app_data_updated ON app_data(updated_at);