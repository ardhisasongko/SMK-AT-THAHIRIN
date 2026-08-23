-- Fotos full base64 harus bisa dikosongkan setelah diarsipkan ke Google Drive.
-- Janji desain migrasi 0004 ("lalu data dikosongkan") tak pernah terealisasi
-- karena kolom data bertipe NOT NULL. Rebuild tabel agar data boleh NULL;
-- thumbnail (thumb) tetap permanen di D1 untuk UI.

CREATE TABLE photos_data_nullable (
  id TEXT PRIMARY KEY,
  data TEXT,
  mime TEXT NOT NULL DEFAULT 'image/jpeg',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  thumb TEXT,
  drive_link TEXT,
  pushed INTEGER NOT NULL DEFAULT 0
);

INSERT INTO photos_data_nullable (id, data, mime, created_by, created_at, thumb, drive_link, pushed)
  SELECT id, data, mime, created_by, created_at, thumb, drive_link, pushed FROM photos;

DROP TABLE photos;
ALTER TABLE photos_data_nullable RENAME TO photos;

CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at);
CREATE INDEX IF NOT EXISTS idx_photos_pushed ON photos(pushed);
CREATE INDEX IF NOT EXISTS idx_photos_user_created ON photos(created_by, created_at DESC);
