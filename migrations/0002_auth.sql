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

-- Seed akun demo (password ter-hash PBKDF2-SHA256, 100000 iterasi).
-- admin123 / guru123 / siswa123 / ketua123
INSERT INTO users (id, name, email, nip_nisn, role, class_id, password_hash, ketua_status, approved_by, approved_at)
VALUES
  ('u1', 'Ir. Surantro', 'admin@smksplusatthahirin.sch.id', '19700512 199803 1 002', 'admin', NULL,
   'pbkdf2$100000$09f1587b180fa82cbe53efd41ab89d11$4cce0df0304be6c6a29761ff00280b568882e56b320017d0223fc8e4b44604ea', 'none', NULL, NULL),
  ('u2', 'Bpk. Ahmad Fauzi, S.Pd.', 'guru@smksplusatthahirin.sch.id', '19890215 201502 1 003', 'guru', NULL,
   'pbkdf2$100000$685e5eb8e9e642f043fdd54ae89bed2c$ecffd96ca9e385d10a8cba977a7b44f8dee2e53cd599a7fbe92f61ab213a9c3a', 'none', NULL, NULL),
  ('u3', 'Siti Nurhaliza', 'siswa@smksplusatthahirin.sch.id', '0068123501', 'siswa', 'k2',
   'pbkdf2$100000$ac76447592e71c7404bd36a22a847ae2$f936af4f2896d73002f2924bb4c1b7b4b5a5c97042091942646547760ab22719', 'none', NULL, NULL),
  ('u4', 'Muhammad Rizky Pratama', 'ketua@smksplusatthahirin.sch.id', '0068123491', 'ketua_kelas', 'k1',
   'pbkdf2$100000$a2ae15e07d741df864511b64671b0d55$697e2cbd51fd6e42b51599d28479c02f9037bd9ac62577250398d46059440ee9', 'approved', 'u1', datetime('now'));

-- Hapus user yang password-nya dipakai di demo lama (opsional, jaga kebersihan)
-- DELETE FROM users WHERE id IN ('u1','u2','u3','u4');
