import type { AuthUser } from '../../../_lib/auth';
import { isCbtStaff } from '../../../_lib/cbt';
import { jsonResponse } from '../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

// Antrean koreksi esai: attempt submitted yang esainya belum selesai dinilai
// guru (grading_status='pending_grading'). Guru hanya ujiannya sendiri;
// admin/super_admin semua ujian.
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  const isAdmin = data.user.role === 'admin' || data.user.role === 'super_admin';
  const query = `
    SELECT attempts.id AS attemptId, attempts.exam_id AS examId, attempts.student_name AS siswaName,
      attempts.nisn AS nisn, attempts.submitted_at AS submittedAt, attempts.pg_score AS pgScore,
      attempts.score AS score, exams.title AS examTitle, exams.subject AS subject,
      (SELECT COUNT(*) FROM cbt_questions q WHERE q.exam_id = attempts.exam_id AND q.question_type='essai') AS essayCount
    FROM cbt_attempts attempts
    JOIN cbt_exams exams ON exams.id = attempts.exam_id
    WHERE attempts.status='submitted' AND attempts.grading_status='pending_grading'
    ${isAdmin ? '' : 'AND (exams.teacher_user_id=? OR (exams.teacher_user_id IS NULL AND exams.teacher_name=?))'}
    ORDER BY attempts.submitted_at ASC`;
  const statement = isAdmin ? env.DB.prepare(query) : env.DB.prepare(query).bind(data.user.id, data.user.name);
  const { results } = await statement.all();
  return jsonResponse({
    success: true,
    data: results.map((row: any) => ({
      attemptId: String(row.attemptId), examId: String(row.examId), examTitle: String(row.examTitle), subject: String(row.subject),
      siswaName: String(row.siswaName), nisn: String(row.nisn), submittedAt: row.submittedAt ? String(row.submittedAt) : '',
      pgScore: row.pgScore != null ? Number(row.pgScore) : Number(row.score || 0), essayCount: Number(row.essayCount || 0),
    })),
  });
};
