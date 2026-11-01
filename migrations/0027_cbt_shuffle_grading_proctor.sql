-- CBT: pengacakan soal per attempt, penilaian esai manual guru, dan proctoring web.
-- (1) shuffle_seed: seed acak per attempt agar urutan soal & opsi diacak deterministik
--     server-side; NULL = attempt lama (urutan asli, kompatibilitas mundur).
-- (2) Penilaian baru: hanya PG yang dinilai otomatis (pg_score = poin PG sementara/final).
--     Esai dinilai guru: essay_scores_json = { scores: {qid: poin}, notes: {qid: catatan} }.
--     grading_status: NULL = attempt lama (dianggap final), 'pending_grading' = esai
--     belum selesai dikoreksi, 'graded' = skor final. graded_by/graded_at = penilai terakhir.
-- (3) proctor_events_json: agregat ringkas peristiwa proctoring web
--     { tabSwitch, windowBlur, fullscreenExit, updatedAt } — bukan log mentah.
ALTER TABLE cbt_attempts ADD COLUMN shuffle_seed INTEGER;
ALTER TABLE cbt_attempts ADD COLUMN pg_score REAL;
ALTER TABLE cbt_attempts ADD COLUMN essay_scores_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE cbt_attempts ADD COLUMN grading_status TEXT;
ALTER TABLE cbt_attempts ADD COLUMN graded_by TEXT;
ALTER TABLE cbt_attempts ADD COLUMN graded_at TEXT;
ALTER TABLE cbt_attempts ADD COLUMN proctor_events_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_cbt_attempts_grading ON cbt_attempts (grading_status, submitted_at DESC);
