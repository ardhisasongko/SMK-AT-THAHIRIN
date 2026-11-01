import { getUserFromRequest, type AuthEnv } from '../../../_lib/auth';
import { isCbtStaff } from '../../../_lib/cbt';
import { csvResponse, toCsv } from '../../../_lib/csv';
import { consumeRateLimit } from '../../../_lib/rate-limit';

interface Env extends AuthEnv {}

// Ekspor nilai CBT ke CSV. Guru hanya ujian miliknya; admin/super_admin semua ujian.
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const user = await getUserFromRequest(env, request);
  if (!user) return Response.json({ success: false, error: 'Tidak terautentikasi.' }, { status: 401 });
  if (!isCbtStaff(user)) return Response.json({ success: false, error: 'Tidak berwenang.' }, { status: 403 });
  // Hardening Fase C: ekspor adalah endpoint mahal (seluruh attempt) —
  // ember khusus di luar rate limit baca global.
  if (!(await consumeRateLimit(env.DB, `export:${user.id}`, 10, 60 * 60))) {
    return Response.json({ success: false, error: 'Terlalu banyak ekspor. Coba lagi dalam satu jam.' }, { status: 429 });
  }

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const { results } = await env.DB.prepare(`
    SELECT a.nisn, a.student_name, a.submitted_at, a.score, a.correct_count, a.wrong_count,
           a.time_spent_seconds, a.grading_status, a.pg_score, e.title, e.subject, e.exam_type
    FROM cbt_attempts a
    JOIN cbt_exams e ON e.id = a.exam_id
    WHERE a.status = 'submitted' ${isAdmin ? '' : 'AND e.teacher_user_id = ?'}
    ORDER BY a.submitted_at DESC
  `).bind(...(isAdmin ? [] : [user.id])).all<any>();

  const rows: Array<Array<unknown>> = [
    ['NISN', 'Nama Siswa', 'Tanggal Kirim', 'Ujian', 'Mapel', 'Jenis', 'Skor', 'Skor PG', 'Status Koreksi', 'Benar (PG)', 'Salah (PG)', 'Waktu (detik)'],
    ...(results || []).map(row => [
      row.nisn, row.student_name, row.submitted_at, row.title, row.subject,
      row.exam_type, row.score, row.pg_score != null ? row.pg_score : row.score,
      row.grading_status === 'pending_grading' ? 'Menunggu Koreksi Esai' : 'Final',
      row.correct_count, row.wrong_count, row.time_spent_seconds,
    ]),
  ];

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(rows), `nilai-cbt-${date}.csv`);
};