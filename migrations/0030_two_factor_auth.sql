-- Hardening Fase B: verifikasi dua langkah (2FA TOTP) untuk staf
-- (guru/admin/super_admin) dan tantangan login dua langkah.
-- (1) users.totp_secret_enc: secret TOTP pengguna dalam keadaan TERENKRIPSI
--     AES-GCM (kunci dari secret server TOTP_ENCRYPTION_KEY); TIDAK PERNAH
--     disimpan plaintext. NULL = belum pernah menyiapkan 2FA.
-- (2) users.totp_enabled: 1 hanya setelah pemilik membuktikan kode pertama
--     dari aplikasi authenticator (alur setup -> verifikasi -> aktif).
-- (3) totp_recovery_codes: kode pemulihan sekali pakai; yang disimpan hanya
--     hash SHA-256-nya. Baris dengan used_at terisi tidak dapat dipakai lagi.
-- (4) auth_challenges: tantangan langkah kedua setelah password benar.
--     Yang disimpan hanya hash SHA-256 token tantangan; tantangan berumur
--     pendek (10 menit), sekali pakai, dan maks. 5x percobaan kode.
ALTER TABLE users ADD COLUMN totp_secret_enc TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS totp_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_totp_recovery_codes_user ON totp_recovery_codes (user_id);

CREATE TABLE IF NOT EXISTS auth_challenges (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_user ON auth_challenges (user_id);
