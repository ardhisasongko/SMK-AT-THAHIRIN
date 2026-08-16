import type { AuthUser } from '../../../../_lib/auth';
import { canTakeExam, cbtWindowOpen, effectiveCbtStatus, ensureLegacyCbtMigrated, getExamQuestions, hashCbtToken, isCbtStudent, parseJson } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';
import { clearRateLimit, consumeRateLimit } from '../../../../_lib/rate-limit';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStudent(data.user)) return jsonResponse({ success: false, error: 'Hanya siswa yang dapat memulai ujian.' }, 403);
  await ensureLegacyCbtMigrated(env.DB);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (typeof body.token !== 'string' || body.token.length > 32) return jsonResponse({ success: false, error: 'Token tidak valid.' }, 400);
  const exam = await env.DB.prepare('SELECT * FROM cbt_exams WHERE id=?').bind(String(params.id)).first<any>();
  if (!exam || !(await canTakeExam(env.DB, data.user, exam))) return jsonResponse({ success: false, error: 'Ujian tidak tersedia.' }, 404);
  if (effectiveCbtStatus(exam) !== 'active') return jsonResponse({ success: false, error: 'Ujian belum dimulai, dinonaktifkan, atau sudah berakhir.' }, 403);
  const windowCheck = cbtWindowOpen(exam);
  if (!windowCheck.open) return jsonResponse({ success: false, error: windowCheck.reason || 'Ujian belum dibuka.' }, 403);
  const rateKey = `cbt-token:${exam.id}:${data.user.id}`;
  if (!(await consumeRateLimit(env.DB, rateKey, 10, 15 * 60))) return jsonResponse({ success: false, error: 'Terlalu banyak percobaan token. Coba lagi beberapa menit.' }, 429);
  if (await hashCbtToken(body.token) !== exam.token_hash) return jsonResponse({ success: false, error: 'Token ujian tidak valid.' }, 403);
  await clearRateLimit(env.DB, rateKey);
  let attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE exam_id=? AND student_user_id=?').bind(exam.id, data.user.id).first<any>();
  if (attempt?.status === 'submitted') return jsonResponse({ success: false, error: 'Ujian sudah pernah diselesaikan.' }, 409);
  if (attempt?.status === 'expired' || (attempt && Date.now() > new Date(attempt.expires_at).getTime() + 30_000)) {
    if (attempt.status === 'in_progress') {
      await env.DB.prepare("UPDATE cbt_attempts SET status='expired' WHERE id=? AND status='in_progress'").bind(attempt.id).run();
    }
    return jsonResponse({ success: false, error: 'Waktu ujian telah berakhir.' }, 409);
  }
  if (!attempt) {
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + Number(exam.duration_minutes) * 60_000).toISOString();
    const id = `attempt-${crypto.randomUUID()}`;
    try {
      await env.DB.prepare(`INSERT INTO cbt_attempts (id,exam_id,student_user_id,student_name,nisn,status,started_at,expires_at) VALUES (?,?,?,?,?,'in_progress',?,?)`).bind(id, exam.id, data.user.id, data.user.name, data.user.nipNisn || '', startedAt, expiresAt).run();
      attempt = { id, started_at: startedAt, expires_at: expiresAt };
    } catch {
      attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE exam_id=? AND student_user_id=?').bind(exam.id, data.user.id).first<any>();
      if (!attempt || attempt.status === 'submitted') return jsonResponse({ success: false, error: 'Ujian sudah pernah diselesaikan.' }, 409);
    }
  }
  const saved = await env.DB.prepare('SELECT answers_json,doubtful_json FROM cbt_attempt_answers WHERE attempt_id=?').bind(attempt.id).first<any>();
  return jsonResponse({ success: true, data: {
    attemptId: attempt.id, startedAt: attempt.started_at, expiresAt: attempt.expires_at,
    savedAnswers: parseJson(saved?.answers_json, {}), savedDoubtful: parseJson(saved?.doubtful_json, {}),
    exam: { id: exam.id, title: exam.title, subject: exam.subject, classTarget: exam.class_target, durationMinutes: exam.duration_minutes, token: '', teacherName: exam.teacher_name, startDate: exam.start_date, endDate: exam.end_date, openTime: exam.open_time || '', closeTime: exam.close_time || '', examType: exam.exam_type, minSubmitMinutes: exam.min_submit_minutes ?? undefined, status: effectiveCbtStatus(exam), questions: await getExamQuestions(env.DB, exam.id, false) },
  } });
};
