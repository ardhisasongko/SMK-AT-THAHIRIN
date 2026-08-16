-- Lepas CHECK constraint correct_answer IN ('A'..'E') agar soal essai dapat
-- menyimpan kunci jawaban teks, dengan mem-build ulang tabel cbt_questions.
CREATE TABLE cbt_questions_new (
  exam_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'pg',
  options_json TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  PRIMARY KEY (exam_id, id),
  FOREIGN KEY (exam_id) REFERENCES cbt_exams(id) ON DELETE CASCADE
);

INSERT INTO cbt_questions_new (exam_id, id, position, question, question_type, options_json, correct_answer, explanation)
  SELECT exam_id, id, position, question, question_type, options_json, correct_answer, explanation FROM cbt_questions;

DROP TABLE cbt_questions;

ALTER TABLE cbt_questions_new RENAME TO cbt_questions;

CREATE INDEX IF NOT EXISTS idx_cbt_questions_exam ON cbt_questions(exam_id, position);

CREATE TRIGGER IF NOT EXISTS prevent_cbt_question_insert_after_attempt
BEFORE INSERT ON cbt_questions
WHEN EXISTS (SELECT 1 FROM cbt_attempts WHERE exam_id = NEW.exam_id)
BEGIN
  SELECT RAISE(ABORT, 'CBT_EXAM_ALREADY_STARTED');
END;

CREATE TRIGGER IF NOT EXISTS prevent_cbt_question_update_after_attempt
BEFORE UPDATE ON cbt_questions
WHEN EXISTS (SELECT 1 FROM cbt_attempts WHERE exam_id = OLD.exam_id)
BEGIN
  SELECT RAISE(ABORT, 'CBT_EXAM_ALREADY_STARTED');
END;

CREATE TRIGGER IF NOT EXISTS prevent_cbt_question_delete_after_attempt
BEFORE DELETE ON cbt_questions
WHEN EXISTS (SELECT 1 FROM cbt_attempts WHERE exam_id = OLD.exam_id)
BEGIN
  SELECT RAISE(ABORT, 'CBT_EXAM_ALREADY_STARTED');
END;