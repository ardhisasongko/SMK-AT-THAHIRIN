CREATE TABLE IF NOT EXISTS cbt_exams (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  class_target TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 300),
  token_hash TEXT NOT NULL,
  teacher_user_id TEXT,
  teacher_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'upcoming', 'completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cbt_questions (
  exam_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D', 'E')),
  explanation TEXT,
  PRIMARY KEY (exam_id, id),
  FOREIGN KEY (exam_id) REFERENCES cbt_exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cbt_attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  student_user_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  nisn TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'expired')),
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  submitted_at TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  doubtful_json TEXT NOT NULL DEFAULT '{}',
  score INTEGER,
  correct_count INTEGER,
  wrong_count INTEGER,
  time_spent_seconds INTEGER,
  UNIQUE (exam_id, student_user_id),
  FOREIGN KEY (exam_id) REFERENCES cbt_exams(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_cbt_exams_dates ON cbt_exams(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_cbt_questions_exam ON cbt_questions(exam_id, position);
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_student ON cbt_attempts(student_user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_exam ON cbt_attempts(exam_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS forum_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category_type TEXT NOT NULL CHECK (category_type IN ('mapel', 'kelas')),
  category_name TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  author_avatar TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  attachments_json TEXT NOT NULL DEFAULT '[]',
  legacy_like_count INTEGER NOT NULL DEFAULT 0 CHECK (legacy_like_count >= 0),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  is_resolved INTEGER NOT NULL DEFAULT 0 CHECK (is_resolved IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  author_avatar TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  legacy_like_count INTEGER NOT NULL DEFAULT 0 CHECK (legacy_like_count >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS forum_topic_likes (
  topic_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (topic_id, user_id),
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_role TEXT NOT NULL CHECK (target_role IN ('semua', 'guru', 'siswa', 'admin')),
  target_class_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('Ujian', 'Tugas', 'Absensi', 'Forum', 'Pengumuman', 'Sistem')),
  sender_user_id TEXT,
  sender_name TEXT,
  sender_role TEXT,
  action_url TEXT,
  source_kind TEXT,
  source_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  UNIQUE (source_kind, source_id)
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (notification_id, user_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forum_topics_created ON forum_topics(is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_topic ON forum_replies(topic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_role, target_class_id, created_at DESC);
