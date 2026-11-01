import type { AuthUser } from '../../../_lib/auth';
import { jsonResponse } from '../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  const isAdmin = data.user.role === 'admin' || data.user.role === 'super_admin';
  const isTeacher = data.user.role === 'guru';
  if (!isAdmin && !isTeacher && !['siswa', 'ketua_kelas'].includes(data.user.role)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);

  // Rekap nilai hanya memakai skor FINAL (grading_status 'graded' atau NULL
  // untuk attempt lama). Attempt yang esainya menunggu koreksi dihitung
  // terpisah sebagai pendingCount agar tidak mencemari rata-rata.
  const baseSelect = `
    SELECT attempts.student_user_id AS siswaId, attempts.student_name AS siswaName, attempts.nisn AS nisn,
      COUNT(*) AS examCount, ROUND(AVG(attempts.score), 1) AS avgScore,
      MAX(attempts.score) AS bestScore, MIN(attempts.score) AS worstScore
    FROM cbt_attempts attempts
    JOIN cbt_exams exams ON exams.id = attempts.exam_id
    WHERE attempts.status='submitted' AND COALESCE(attempts.grading_status, 'graded') = 'graded'`;

  const scope = isAdmin
    ? ''
    : isTeacher
      ? ` AND (exams.teacher_user_id=? OR (exams.teacher_user_id IS NULL AND exams.teacher_name=?))`
      : ` AND attempts.student_user_id=?`;

  const statement = isAdmin
    ? env.DB.prepare(`${baseSelect} GROUP BY attempts.student_user_id ORDER BY attempts.student_name ASC`)
    : env.DB.prepare(`${baseSelect}${scope} GROUP BY attempts.student_user_id ORDER BY attempts.student_name ASC`)
      .bind(...(isTeacher ? [data.user.id, data.user.name] : [data.user.id]));

  const { results } = await statement.all();

  const pendingSelect = `
    SELECT attempts.student_user_id AS siswaId, COUNT(*) AS pendingCount
    FROM cbt_attempts attempts
    JOIN cbt_exams exams ON exams.id = attempts.exam_id
    WHERE attempts.status='submitted' AND attempts.grading_status='pending_grading'`;
  const pendingStatement = isAdmin
    ? env.DB.prepare(`${pendingSelect} GROUP BY attempts.student_user_id`)
    : env.DB.prepare(`${pendingSelect}${scope} GROUP BY attempts.student_user_id`)
      .bind(...(isTeacher ? [data.user.id, data.user.name] : [data.user.id]));
  const { results: pendingRows } = await pendingStatement.all();
  const pendingByStudent = new Map((pendingRows as any[]).map(row => [String(row.siswaId), Number(row.pendingCount || 0)]));

  return jsonResponse({
    success: true,
    data: results.map((row: any) => ({
      siswaId: String(row.siswaId), siswaName: String(row.siswaName), nisn: String(row.nisn),
      examCount: Number(row.examCount), avgScore: Number(row.avgScore), bestScore: Number(row.bestScore), worstScore: Number(row.worstScore),
      pendingCount: pendingByStudent.get(String(row.siswaId)) || 0,
    })),
  });
};