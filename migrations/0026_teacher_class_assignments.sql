-- Penugasan wali kelas berbasis user ID (menggantikan pencocokan nama string
-- yang rapuh: 'Bpk Fahri Sujana' vs akun 'M. FACHRI SUJANA', dsb.).
-- Guru yang punya >=1 penugasan dibatasi ke kelasnya; guru tanpa penugasan
-- masih boleh semua kelas (transisi aman, perilaku lama).
-- Seed dari data produksi 23 Agustus 2026 (wali_kelas pada school_classes):
--   X MPLB 1   -> Nurul Faizah Ulfah
--   XI MPLB 1  -> M. Fachri Sujana (nama waliKelas tertulis 'Fahri' — typo)
--   XII MPLB 1 -> Rudiyatno

CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  user_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, class_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (class_id) REFERENCES school_classes(id)
);

-- Seed no-op aman: baris hanya dibuat bila user DAN kelas benar-benar ada,
-- sehingga deploy sekolah baru (blueprint) tidak gagal karena FK.
INSERT OR IGNORE INTO teacher_class_assignments (user_id, class_id)
  SELECT u.id, c.id FROM users u JOIN school_classes c ON c.id = 'k1'
  WHERE u.id = 'u-g3201255307010000';
INSERT OR IGNORE INTO teacher_class_assignments (user_id, class_id)
  SELECT u.id, c.id FROM users u JOIN school_classes c ON c.id = 'k2'
  WHERE u.id = 'u-g3201261110971000';
INSERT OR IGNORE INTO teacher_class_assignments (user_id, class_id)
  SELECT u.id, c.id FROM users u JOIN school_classes c ON c.id = 'k3'
  WHERE u.id = 'u-g3201262801650000';
