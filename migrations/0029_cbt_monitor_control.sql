-- CBT Ruang Kontrol (proctoring live): pengumuman siaran pengawas, audit kendali
-- pengawas, dan penanda attempt yang dikumpulkan oleh pengawas.
-- (1) cbt_exam_announcements: pengumuman dari pengawas (guru pemilik/admin) yang
--     tampil sebagai banner di runner SEMUA siswa yang sedang mengerjakan ujian
--     itu. Dismiss per attempt dicatat client-side (sesi runner), bukan di sini.
-- (2) cbt_monitor_actions: jejak audit setiap aksi kendali ruang kontrol —
--     'announcement' (attempt_id NULL), 'extend_time' (attempt_id terisi, atau
--     NULL + detail scope='all_in_progress' untuk perpanjangan massal), dan
--     'force_submit' (attempt_id terisi). detail_json menyimpan konteks ringkas
--     (menit tambahan / expires_at baru / kutipan pesan) untuk penelusuran.
-- (3) cbt_attempts.submitted_by: 'student' (default, termasuk semua attempt
--     lama) atau 'proctor' bila attempt diselesaikan paksa oleh pengawas lewat
--     ruang kontrol — tampil sebagai penanda "oleh pengawas" di hasil & monitor.
CREATE TABLE IF NOT EXISTS cbt_exam_announcements (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (exam_id) REFERENCES cbt_exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cbt_monitor_actions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  attempt_id TEXT,
  actor_user_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('extend_time', 'force_submit', 'announcement')),
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (exam_id) REFERENCES cbt_exams(id) ON DELETE CASCADE
);

ALTER TABLE cbt_attempts ADD COLUMN submitted_by TEXT NOT NULL DEFAULT 'student';

CREATE INDEX IF NOT EXISTS idx_cbt_announcements_exam ON cbt_exam_announcements (exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbt_monitor_actions_exam ON cbt_monitor_actions (exam_id, created_at DESC);
