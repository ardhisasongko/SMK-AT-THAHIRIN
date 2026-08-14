import type { AuthUser } from '../../../_lib/auth';
import { ensureLegacyCbtMigrated, getExamQuestions, hashCbtToken, isCbtStaff, isCbtStudent, todayWIB, ANSWER_KEYS, canManageCbtExam, canTakeExam } from '../../../_lib/cbt';
import { jsonResponse } from '../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  await ensureLegacyCbtMigrated(env.DB);
  const { results } = await env.DB.prepare('SELECT * FROM cbt_exams ORDER BY created_at DESC').all();
  const exams = [];
  for (const row of results as any[]) {
    if (isCbtStudent(data.user) && !(await canTakeExam(env.DB, data.user, row))) continue;
    if (isCbtStaff(data.user) && !canManageCbtExam(data.user, row)) continue;
    const staff = isCbtStaff(data.user);
    const questions = staff ? await getExamQuestions(env.DB, String(row.id), true) : [];
    const attempt = isCbtStudent(data.user)
      ? await env.DB.prepare('SELECT id,status,score,correct_count,wrong_count,submitted_at,time_spent_seconds,answers_json,doubtful_json FROM cbt_attempts WHERE exam_id=? AND student_user_id=?').bind(row.id, data.user.id).first()
      : null;
    exams.push({
      id: String(row.id), title: String(row.title), subject: String(row.subject), classTarget: String(row.class_target),
      durationMinutes: Number(row.duration_minutes), token: '', teacherName: String(row.teacher_name),
      startDate: String(row.start_date), endDate: String(row.end_date), status: String(row.status),
      questions, questionCount: staff ? questions.length : Number((await env.DB.prepare('SELECT COUNT(*) AS total FROM cbt_questions WHERE exam_id=?').bind(row.id).first<any>())?.total || 0),
      attempt: attempt ? {
        id: String(attempt.id), examId: String(row.id), siswaId: data.user.id, siswaName: data.user.name, nisn: data.user.nipNisn || '',
        answers: JSON.parse(String(attempt.answers_json || '{}')), doubtful: JSON.parse(String(attempt.doubtful_json || '{}')),
        score: Number(attempt.score || 0), correctCount: Number(attempt.correct_count || 0), wrongCount: Number(attempt.wrong_count || 0),
        submittedAt: String(attempt.submitted_at || ''), timeSpentSeconds: Number(attempt.time_spent_seconds || 0), status: String(attempt.status),
      } : null,
    });
  }
  return jsonResponse({ success: true, data: exams });
};

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang membuat ujian.' }, 403);
  await ensureLegacyCbtMigrated(env.DB);
  if (Number(request.headers.get('Content-Length') || 0) > 512_000) return jsonResponse({ success: false, error: 'Paket ujian terlalu besar.' }, 413);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200 || typeof body.subject !== 'string' || body.subject.length > 150 || !Number.isInteger(body.durationMinutes) || body.durationMinutes < 1 || body.durationMinutes > 300 || typeof body.token !== 'string' || body.token.length < 4 || body.token.length > 32 || questions.length < 1 || questions.length > 200) {
    return jsonResponse({ success: false, error: 'Data ujian tidak valid.' }, 400);
  }
  for (const question of questions) {
    if (!question?.id || typeof question.question !== 'string' || !question.question.trim() || question.question.length > 2000 || !Array.isArray(question.options) || !ANSWER_KEYS.has(question.correctAnswer)) {
      return jsonResponse({ success: false, error: 'Format soal tidak valid.' }, 400);
    }
  }
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) ? body.startDate : todayWIB();
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(body.endDate) && body.endDate >= startDate ? body.endDate : startDate;
  const id = `cbt-${crypto.randomUUID()}`;
  const statements = [
    env.DB.prepare(`INSERT INTO cbt_exams (id,title,subject,class_target,duration_minutes,token_hash,teacher_user_id,teacher_name,start_date,end_date,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, body.title.trim(), body.subject.trim(), String(body.classTarget || 'Semua Kelas MPLB').slice(0, 100), body.durationMinutes, await hashCbtToken(body.token), data.user.id, data.user.name, startDate, endDate, 'active'),
    ...questions.map((question: any, index: number) => env.DB.prepare(`INSERT INTO cbt_questions (exam_id,id,position,question,options_json,correct_answer,explanation) VALUES (?,?,?,?,?,?,?)`).bind(id, String(question.id).slice(0, 100), index, question.question.trim(), JSON.stringify(question.options), question.correctAnswer, question.explanation ? String(question.explanation).slice(0, 2000) : null)),
  ];
  await env.DB.batch(statements);
  return jsonResponse({ success: true, data: { ...body, id, teacherName: data.user.name, startDate, endDate, status: 'active', token: body.token.toUpperCase() } }, 201);
};
