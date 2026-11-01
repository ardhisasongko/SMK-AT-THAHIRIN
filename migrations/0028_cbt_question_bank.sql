-- Bank soal CBT: koleksi soal yang dapat dipakai ulang lintas ujian per guru.
-- Soal di bank adalah sumber salinan (snapshot): menyalin soal ke paket ujian
-- membuat baris cbt_questions baru; mengubah bank TIDAK mengubah ujian yang
-- sudah dibuat (konsisten dengan trigger proteksi soal setelah ujian dimulai).
CREATE TABLE IF NOT EXISTS cbt_question_bank (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT,
  question_type TEXT NOT NULL DEFAULT 'pg',
  question TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cbt_bank_owner ON cbt_question_bank (owner_user_id, subject);
CREATE INDEX IF NOT EXISTS idx_cbt_bank_subject ON cbt_question_bank (subject);
