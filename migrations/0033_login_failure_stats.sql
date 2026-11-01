-- Hardening Fase E: statistik kegagalan login per jam untuk panel status
-- admin & pemantauan. Satu baris per jam UTC ('YYYY-MM-DDTHH'); panel
-- menjumlahkan 24 ember terakhir sebagai "kegagalan login 24 jam".
-- Ember lama (>48 jam) dibersihkan oportunistik saat pencatatan baru,
-- sehingga tabel tetap kecil. Hanya AGREGAT jumlah — tanpa identifier,
-- tanpa alamat IP, tanpa data pribadi.
CREATE TABLE IF NOT EXISTS login_failure_stats (
  hour TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
