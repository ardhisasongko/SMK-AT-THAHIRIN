-- Migrasi penyimpanan foto presensi di D1 (pengganti R2, tanpa kartu/biaya).
-- Foto disimpan sebagai base64 (terkompres di client ~100-250KB -> ~150-330KB base64).

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,                        -- base64 dari gambar
  mime TEXT NOT NULL DEFAULT 'image/jpeg',
  created_by TEXT,                           -- user id yang mengupload
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at);
