-- Dukungan soal essai di CBT: tipe soal per pertanyaan
ALTER TABLE cbt_questions ADD COLUMN question_type TEXT NOT NULL DEFAULT 'pg';