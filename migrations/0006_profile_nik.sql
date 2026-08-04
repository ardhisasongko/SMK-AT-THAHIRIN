-- Migrasi profil: kolom NIK & tanggal lahir untuk akun users.
-- (Siswa memakai NISN sebagai nip_nisn; NIK utamanya dimiliki guru.)
ALTER TABLE users ADD COLUMN nik TEXT;
ALTER TABLE users ADD COLUMN tanggal_lahir TEXT;
