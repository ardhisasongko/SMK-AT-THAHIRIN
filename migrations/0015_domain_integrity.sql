ALTER TABLE forum_topics ADD COLUMN class_id TEXT;

UPDATE forum_topics
SET class_id = (
  SELECT json_extract(item.value, '$.id')
  FROM app_data, json_each(app_data.value) AS item
  WHERE app_data.key = 'kelas_v1'
    AND json_extract(item.value, '$.name') = forum_topics.category_name
  LIMIT 1
)
WHERE category_type = 'kelas' AND class_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_forum_topics_class ON forum_topics(category_type, class_id);

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
