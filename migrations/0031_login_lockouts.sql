-- Hardening Fase C: lockout login bertahap per akun dan per IP.
-- Satu baris per kunci: 'account:<identifier ternormalisasi>' atau
-- 'ip:<alamat IP>'. failures = kegagalan beruntun sejak kunci terakhir /
-- login berhasil; lock_level menaikkan durasi kunci berikutnya
-- (5 -> 15 -> 60 -> 240 -> 1440 menit); locked_until NULL = tidak terkunci.
-- Login berhasil menghapus baris akun; reset password oleh admin juga
-- menghapus baris akun target (jalan pemulihan resmi selain menunggu).
CREATE TABLE IF NOT EXISTS login_lockouts (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  lock_level INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
