-- Migrasi autentikasi & RBAC untuk SMKS PLUS AT THAHIRIN
-- Tabel users (akun login) + sessions (token sesi).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  nip_nisn TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'siswa',        -- admin | guru | ketua_kelas | siswa
  class_id TEXT,                             -- untuk guru/ketua_kelas/siswa
  password_hash TEXT NOT NULL,
  jabatan TEXT,
  ketua_status TEXT NOT NULL DEFAULT 'none', -- none | pending | approved
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Seed akun admin awal (password ter-hash PBKDF2-SHA256, 100000 iterasi).
-- Catatan: akun admin adalah satu-satunya seed; akun guru/siswa diimpor massal
-- dari data sekolah via scripts/import-data.mjs. Password admin default sebaiknya
-- diganti segera setelah deployment (lihat /api/users/... atau kelola via UI admin).
INSERT INTO users (id, name, email, nip_nisn, role, class_id, password_hash, ketua_status, approved_by, approved_at)
VALUES
  ('u1', 'Ir. Surantro', 'admin@smksplusatthahirin.sch.id', '19700512 199803 1 002', 'admin', NULL,
   'pbkdf2$100000$09f1587b180fa82cbe53efd41ab89d11$4cce0df0304be6c6a29761ff00280b568882e56b320017d0223fc8e4b44604ea', 'none', NULL, NULL);
