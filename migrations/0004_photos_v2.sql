-- Migrasi foto v2: D1 hanya menyimpan THUMBNAIL permanen + foto FULL sementara.
-- Foto full dipindahkan ke Google Drive oleh Worker cron (harian), lalu `data` dikosongkan.
-- `drive_link` menyimpan URL Drive; `pushed` = 1 bila sudah ter-sync ke Drive.

ALTER TABLE photos ADD COLUMN thumb TEXT;                        -- thumbnail permanen (base64 kecil)
ALTER TABLE photos ADD COLUMN drive_link TEXT;                   -- URL foto full di Google Drive
ALTER TABLE photos ADD COLUMN pushed INTEGER NOT NULL DEFAULT 0; -- 0 = belum dipush ke Drive

CREATE INDEX IF NOT EXISTS idx_photos_pushed ON photos(pushed);
