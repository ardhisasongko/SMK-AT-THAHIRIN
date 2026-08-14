import type { AuthUser } from './auth';

export const CBT_STAFF_ROLES = ['guru', 'admin', 'super_admin'];
export const CBT_STUDENT_ROLES = ['siswa', 'ketua_kelas'];
export const ANSWER_KEYS = new Set(['A', 'B', 'C', 'D', 'E']);

export async function hashCbtToken(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token.trim().toUpperCase()));
  return Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, '0')).join('');
}

export function isCbtStaff(user: AuthUser): boolean {
  return CBT_STAFF_ROLES.includes(user.role);
}

export function isCbtStudent(user: AuthUser): boolean {
  return CBT_STUDENT_ROLES.includes(user.role);
}

export function canManageCbtExam(user: AuthUser, exam: { teacher_user_id?: unknown; teacher_name?: unknown }): boolean {
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  if (user.role !== 'guru') return false;
  return exam.teacher_user_id === user.id
    || (!exam.teacher_user_id && exam.teacher_name === user.name);
}

export function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return typeof value === 'string' ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function scoreCbtAnswers(questions: Array<{ id: string; correctAnswer?: string }>, answers: Record<string, string>) {
  const correctCount = questions.filter(question => answers[question.id] === question.correctAnswer).length;
  const wrongCount = questions.length - correctCount;
  return { correctCount, wrongCount, score: questions.length ? Math.round(correctCount / questions.length * 100) : 0 };
}

export async function getExamQuestions(db: D1Database, examId: string, includeAnswers: boolean): Promise<any[]> {
  const { results } = await db.prepare(
    'SELECT id, question, options_json, correct_answer, explanation FROM cbt_questions WHERE exam_id = ? ORDER BY position'
  ).bind(examId).all();
  return results.map((row: any) => ({
    id: String(row.id),
    question: String(row.question),
    options: parseJson(row.options_json, []),
    ...(includeAnswers ? { correctAnswer: String(row.correct_answer), explanation: row.explanation ? String(row.explanation) : undefined } : {}),
  }));
}

export async function canTakeExam(db: D1Database, user: AuthUser, exam: any): Promise<boolean> {
  if (!isCbtStudent(user) || !user.classId) return false;
  if (exam.class_target === 'Semua Kelas MPLB' || exam.class_target === 'all' || exam.class_target === user.classId) return true;
  const classesRow = await db.prepare("SELECT value FROM app_data WHERE key = 'kelas_v1'").first<{ value: string }>();
  const classes = parseJson<any[]>(classesRow?.value, []);
  return classes.some(item => item.id === user.classId && item.name === exam.class_target);
}

export async function ensureLegacyCbtMigrated(db: D1Database): Promise<void> {
  const migrationKey = 'legacy_cbt_v1';
  const migrated = await db.prepare('SELECT key FROM domain_migrations WHERE key=?').bind(migrationKey).first();
  if (migrated) return;
  const row = await db.prepare("SELECT value FROM app_data WHERE key = 'cbtExams_v1'").first<{ value: string }>();
  const exams = parseJson<any[]>(row?.value, []);
  for (const exam of exams) {
    if (!exam?.id || !exam?.title || !Array.isArray(exam.questions) || !exam.token) continue;
    const statements = [
      db.prepare(`INSERT OR IGNORE INTO cbt_exams
        (id,title,subject,class_target,duration_minutes,token_hash,teacher_name,start_date,end_date,status)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
        String(exam.id), String(exam.title).slice(0, 200), String(exam.subject || '').slice(0, 150),
        String(exam.classTarget || 'Semua Kelas MPLB').slice(0, 100), Math.max(1, Math.min(300, Number(exam.durationMinutes) || 30)),
        await hashCbtToken(String(exam.token)), String(exam.teacherName || 'Guru'),
        /^\d{4}-\d{2}-\d{2}$/.test(exam.startDate) ? exam.startDate : todayWIB(),
        /^\d{4}-\d{2}-\d{2}$/.test(exam.endDate) ? exam.endDate : '2099-12-31',
        ['active', 'upcoming', 'completed'].includes(exam.status) ? exam.status : 'active'
      ),
      ...exam.questions.map((question: any, index: number) => db.prepare(`INSERT OR IGNORE INTO cbt_questions
        (exam_id,id,position,question,options_json,correct_answer,explanation) VALUES (?,?,?,?,?,?,?)`).bind(
        String(exam.id), String(question.id || `q-${index + 1}`), index,
        String(question.question || '').slice(0, 2000), JSON.stringify(Array.isArray(question.options) ? question.options : []),
        ANSWER_KEYS.has(question.correctAnswer) ? question.correctAnswer : 'A',
        question.explanation ? String(question.explanation).slice(0, 2000) : null
      )),
    ];
    await db.batch(statements);
  }
  const submissionsRow = await db.prepare("SELECT value FROM app_data WHERE key = 'cbtSubmissions_v1'").first<{ value: string }>();
  const submissions = parseJson<any[]>(submissionsRow?.value, []);
  for (const submission of submissions) {
    const user = submission?.nisn ? await db.prepare('SELECT id,name,nip_nisn FROM users WHERE nip_nisn=?').bind(String(submission.nisn)).first<any>() : null;
    const exam = submission?.examId ? await db.prepare('SELECT id FROM cbt_exams WHERE id=?').bind(String(submission.examId)).first<any>() : null;
    if (!user || !exam) continue;
    const questions = await getExamQuestions(db, String(exam.id), true);
    const result = scoreCbtAnswers(questions, submission.answers || {});
    const submittedAt = new Date().toISOString();
    await db.prepare(`INSERT OR IGNORE INTO cbt_attempts (id,exam_id,student_user_id,student_name,nisn,status,started_at,expires_at,submitted_at,answers_json,doubtful_json,score,correct_count,wrong_count,time_spent_seconds)
      VALUES (?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?)`).bind(`attempt-${crypto.randomUUID()}`, exam.id, user.id, user.name, user.nip_nisn || '', submittedAt, submittedAt, submittedAt, JSON.stringify(submission.answers || {}), JSON.stringify(submission.doubtful || {}), result.score, result.correctCount, result.wrongCount, Math.max(0, Number(submission.timeSpentSeconds || 0))).run();
  }
  await db.prepare('INSERT OR IGNORE INTO domain_migrations (key) VALUES (?)').bind(migrationKey).run();
}
