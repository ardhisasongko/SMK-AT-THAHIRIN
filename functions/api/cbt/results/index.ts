import type { AuthUser } from '../../../_lib/auth';
import { ensureLegacyCbtMigrated, parseJson } from '../../../_lib/cbt';
import { jsonResponse } from '../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  await ensureLegacyCbtMigrated(env.DB);
  const isAdmin = data.user.role === 'admin' || data.user.role === 'super_admin';
  const query = isAdmin
    ? "SELECT * FROM cbt_attempts WHERE status='submitted' ORDER BY submitted_at DESC"
    : data.user.role === 'guru'
      ? `SELECT attempts.* FROM cbt_attempts attempts
         JOIN cbt_exams exams ON exams.id=attempts.exam_id
         WHERE attempts.status='submitted' AND (exams.teacher_user_id=? OR (exams.teacher_user_id IS NULL AND exams.teacher_name=?))
         ORDER BY attempts.submitted_at DESC`
      : "SELECT * FROM cbt_attempts WHERE status='submitted' AND student_user_id=? ORDER BY submitted_at DESC";
  const statement = isAdmin
    ? env.DB.prepare(query)
    : data.user.role === 'guru'
      ? env.DB.prepare(query).bind(data.user.id, data.user.name)
      : env.DB.prepare(query).bind(data.user.id);
  const { results } = await statement.all();
  return jsonResponse({ success: true, data: results.map((row: any) => ({ id: row.id, examId: row.exam_id, siswaId: row.student_user_id, siswaName: row.student_name, nisn: row.nisn, answers: parseJson(row.answers_json, {}), doubtful: parseJson(row.doubtful_json, {}), score: Number(row.score), correctCount: Number(row.correct_count), wrongCount: Number(row.wrong_count), submittedAt: row.submitted_at, timeSpentSeconds: Number(row.time_spent_seconds) })) });
};
