import type { AuthUser } from '../../../../_lib/auth';
import { ANSWER_KEYS, getExamQuestions, isCbtStudent, parseJson, scoreCbtAnswers } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStudent(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) return jsonResponse({ success: false, error: 'Jawaban tidak valid.' }, 400);
  const attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE id=? AND student_user_id=?').bind(String(params.id), data.user.id).first<any>();
  if (!attempt) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
  if (attempt.status === 'submitted') return jsonResponse({ success: true, data: toSubmission(attempt) });
  if (Date.now() > new Date(attempt.expires_at).getTime() + 30_000) {
    await env.DB.prepare("UPDATE cbt_attempts SET status='expired' WHERE id=? AND status='in_progress'").bind(attempt.id).run();
    return jsonResponse({ success: false, error: 'Waktu ujian telah berakhir.' }, 409);
  }
  const questions = await getExamQuestions(env.DB, String(attempt.exam_id), true);
  const validIds = new Set(questions.map(question => question.id));
  for (const [questionId, answer] of Object.entries(body.answers)) {
    if (!validIds.has(questionId) || typeof answer !== 'string' || !ANSWER_KEYS.has(answer)) return jsonResponse({ success: false, error: 'Jawaban memuat soal atau opsi yang tidak valid.' }, 400);
  }
  const { correctCount: correct, wrongCount: wrong, score } = scoreCbtAnswers(questions, body.answers);
  const submittedAt = new Date().toISOString();
  const timeSpent = Math.max(0, Math.min(Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000), Math.round((new Date(attempt.expires_at).getTime() - new Date(attempt.started_at).getTime()) / 1000)));
  await env.DB.prepare(`UPDATE cbt_attempts SET status='submitted',submitted_at=?,answers_json=?,doubtful_json=?,score=?,correct_count=?,wrong_count=?,time_spent_seconds=? WHERE id=? AND student_user_id=? AND status='in_progress'`).bind(submittedAt, JSON.stringify(body.answers), JSON.stringify(body.doubtful || {}), score, correct, wrong, timeSpent, attempt.id, data.user.id).run();
  const saved = { ...attempt, status: 'submitted', submitted_at: submittedAt, answers_json: JSON.stringify(body.answers), doubtful_json: JSON.stringify(body.doubtful || {}), score, correct_count: correct, wrong_count: wrong, time_spent_seconds: timeSpent };
  return jsonResponse({ success: true, data: toSubmission(saved) });
};

function toSubmission(row: any) {
  return { id: String(row.id), examId: String(row.exam_id), siswaId: String(row.student_user_id), siswaName: String(row.student_name), nisn: String(row.nisn), answers: parseJson(row.answers_json, {}), doubtful: parseJson(row.doubtful_json, {}), score: Number(row.score || 0), correctCount: Number(row.correct_count || 0), wrongCount: Number(row.wrong_count || 0), submittedAt: String(row.submitted_at || ''), timeSpentSeconds: Number(row.time_spent_seconds || 0) };
}
