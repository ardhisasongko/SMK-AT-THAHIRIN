-- Hardening D1: index tambahan sesuai pola query produksi (analisis 17 Agu 2026).
-- Semua index dari kandidat prioritas tinggi/sedang:
-- 1) cbt_attempts(status, submitted_at DESC)  — 4 query analitik/hasil/ekspor memfilter status='submitted' + urut submitted_at (saat ini full scan).
-- 2) cbt_attempts(nisn, status, submitted_at DESC) — rapor per NISN (2 query).
-- 3) attendance_records(nisn, status, tanggal) — rekap presensi rapor per NISN (tabel paling cepat membesar).
-- 4) cbt_exams(teacher_user_id) — filter analitik guru + hasHistoricalReferences.
-- 5) forum_topics(author_user_id) / 6) forum_replies(author_user_id) / 7) notifications(sender_user_id, created_at DESC) / 8) whatsapp_outbox(teacher_user_id) — EXISTS hapus user permanen + branch sender di list notifikasi.

CREATE INDEX IF NOT EXISTS idx_cbt_attempts_status_submitted
  ON cbt_attempts(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_cbt_attempts_nisn
  ON cbt_attempts(nisn, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_nisn
  ON attendance_records(nisn, status, tanggal);

CREATE INDEX IF NOT EXISTS idx_cbt_exams_teacher
  ON cbt_exams(teacher_user_id);

CREATE INDEX IF NOT EXISTS idx_forum_topics_author
  ON forum_topics(author_user_id);

CREATE INDEX IF NOT EXISTS idx_forum_replies_author
  ON forum_replies(author_user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_sender
  ON notifications(sender_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_outbox_teacher
  ON whatsapp_outbox(teacher_user_id);