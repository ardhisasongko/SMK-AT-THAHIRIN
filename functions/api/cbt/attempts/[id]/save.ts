import type { AuthUser } from '../../../../_lib/auth';
import { ANSWER_KEYS, getExamQuestions, isCbtStudent } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStudent(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (body.answers && (typeof body.answers !== 'object' || Array.isArray(body.answers))) return jsonResponse({ success: false, error: 'Jawaban tidak valid.' }, 400);
  if (body.doubtful && (typeof body.doubtful !== 'object' || Array.isArray(body.doubtful))) return jsonResponse({ success: false, error: 'Tanda ragu-ragu tidak valid.' }, 400);
  const attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE id=? AND student_user_id=?').bind(String(params.id), data.user.id).first<any>();
  if (!attempt) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
  if (attempt.status !== 'in_progress') return jsonResponse({ success: false, error: attempt.status === 'submitted' ? 'Ujian sudah diselesaikan.' : 'Waktu ujian telah berakhir.' }, 409);
  if (Date.now() > new Date(attempt.expires_at).getTime() + 30_000) {
    await env.DB.prepare("UPDATE cbt_attempts SET status='expired' WHERE id=? AND status='in_progress'").bind(attempt.id).run();
    return jsonResponse({ success: false, error: 'Waktu ujian telah berakhir.' }, 409);
  }
  const questions = await getExamQuestions(env.DB, String(attempt.exam_id), true);
  const byId = new Map(questions.map(question => [question.id, question]));
  const answers = body.answers || {};
  const doubtful = body.doubtful || {};
  for (const [questionId, answer] of Object.entries(answers)) {
    const question = byId.get(questionId);
    if (!question || typeof answer !== 'string') return jsonResponse({ success: false, error: 'Jawaban memuat soal atau opsi yang tidak valid.' }, 400);
    if (question.type === 'essai') {
      if (answer.length > 4000) return jsonResponse({ success: false, error: 'Jawaban essai terlalu panjang (maksimal 4000 karakter).' }, 400);
    } else if (!ANSWER_KEYS.has(answer)) {
      return jsonResponse({ success: false, error: 'Jawaban memuat soal atau opsi yang tidak valid.' }, 400);
    }
  }
  for (const questionId of Object.keys(doubtful)) {
    if (!byId.has(questionId)) return jsonResponse({ success: false, error: 'Tanda ragu-ragu memuat soal yang tidak valid.' }, 400);
  }
  await env.DB.prepare(`INSERT OR REPLACE INTO cbt_attempt_answers (attempt_id,answers_json,doubtful_json,saved_at) VALUES (?,?,?,datetime('now'))`).bind(attempt.id, JSON.stringify(answers), JSON.stringify(doubtful)).run();
  return jsonResponse({ success: true, data: { attemptId: String(attempt.id), savedAt: new Date().toISOString() } });
};