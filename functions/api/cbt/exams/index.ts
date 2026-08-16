import type { AuthUser } from '../../../_lib/auth';
import { effectiveCbtStatus, ensureLegacyCbtMigrated, getExamQuestions, hashCbtToken, isCbtStaff, isCbtStudent, todayWIB, canManageCbtExam, canTakeExam, parseJson, validateCbtExamInput } from '../../../_lib/cbt';
import { jsonResponse } from '../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  await ensureLegacyCbtMigrated(env.DB);
  const { results } = await env.DB.prepare('SELECT * FROM cbt_exams ORDER BY created_at DESC').all();
  const exams = [];
  for (const row of results as any[]) {
    if (isCbtStudent(data.user) && effectiveCbtStatus(row) === 'inactive') continue;
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
      startDate: String(row.start_date), endDate: String(row.end_date), openTime: row.open_time || '', closeTime: row.close_time || '', status: effectiveCbtStatus(row),
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
  const validationError = validateCbtExamInput(body);
  if (validationError) return jsonResponse({ success: false, error: validationError }, 400);
  const questions = body.questions as any[];
  if (!(await validClassTarget(env.DB, body.classTarget))) return jsonResponse({ success: false, error: 'Target kelas tidak ditemukan.' }, 400);
  const startDate = body.startDate;
  const endDate = body.endDate;
  const status = startDate > todayWIB() ? 'upcoming' : 'active';
  const id = `cbt-${crypto.randomUUID()}`;
  const statements = [
    env.DB.prepare(`INSERT INTO cbt_exams (id,title,subject,class_target,duration_minutes,token_hash,teacher_user_id,teacher_name,start_date,end_date,open_time,close_time,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, body.title.trim(), body.subject.trim(), String(body.classTarget).slice(0, 100), body.durationMinutes, await hashCbtToken(body.token), data.user.id, data.user.name, startDate, endDate, body.openTime || null, body.closeTime || null, status),
    ...questionStatements(env.DB, id, questions),
  ];
  await env.DB.batch(statements);
  return jsonResponse({ success: true, data: { ...body, id, teacherName: data.user.name, startDate, endDate, status, token: body.token.trim().toUpperCase() } }, 201);
};

export const onRequestPatch: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const exam = await env.DB.prepare('SELECT * FROM cbt_exams WHERE id=?').bind(String(body.id || '')).first<any>();
  if (!exam) return jsonResponse({ success: false, error: 'Ujian tidak ditemukan.' }, 404);
  if (!canManageCbtExam(data.user, exam)) return jsonResponse({ success: false, error: 'Anda hanya dapat mengelola ujian milik sendiri.' }, 403);

  if (body.status && Object.keys(body).every(key => key === 'id' || key === 'status')) {
    if (!['active', 'inactive', 'completed'].includes(body.status)) return jsonResponse({ success: false, error: 'Status ujian tidak valid.' }, 400);
    if (exam.status === 'completed' && body.status !== 'completed') return jsonResponse({ success: false, error: 'Ujian yang sudah selesai tidak dapat diaktifkan kembali.' }, 409);
    if (body.status === 'active' && String(exam.end_date) < todayWIB()) return jsonResponse({ success: false, error: 'Ujian yang tanggal akhirnya lewat tidak dapat diaktifkan.' }, 409);
    const storedStatus = body.status === 'active' ? (String(exam.start_date) > todayWIB() ? 'upcoming' : 'active') : body.status === 'inactive' ? exam.status : 'completed';
    const isActive = body.status === 'active' ? 1 : 0;
    await env.DB.prepare("UPDATE cbt_exams SET status=?,is_active=?,updated_at=datetime('now') WHERE id=?").bind(storedStatus, isActive, exam.id).run();
    return jsonResponse({ success: true, data: { id: String(exam.id), status: body.status === 'inactive' ? 'inactive' : storedStatus } });
  }

  const validationError = validateCbtExamInput(body, false);
  if (validationError) return jsonResponse({ success: false, error: validationError }, 400);
  if (!(await validClassTarget(env.DB, body.classTarget))) return jsonResponse({ success: false, error: 'Target kelas tidak ditemukan.' }, 400);
  const existingAttempt = await env.DB.prepare('SELECT id FROM cbt_attempts WHERE exam_id=? LIMIT 1').bind(exam.id).first();
  if (existingAttempt) return jsonResponse({ success: false, error: 'Paket soal tidak dapat diedit setelah ujian mulai dikerjakan.' }, 409);
  const isActive = Number(exam.is_active ?? 1);
  const storedStatus = body.startDate > todayWIB() ? 'upcoming' : exam.status === 'completed' ? 'completed' : 'active';
  const responseStatus = isActive === 0 ? 'inactive' : storedStatus;
  const statements = [
    env.DB.prepare(`UPDATE cbt_exams SET title=?,subject=?,class_target=?,duration_minutes=?,start_date=?,end_date=?,open_time=?,close_time=?,status=?,updated_at=datetime('now') WHERE id=?`).bind(body.title.trim(), body.subject.trim(), body.classTarget, body.durationMinutes, body.startDate, body.endDate, body.openTime || null, body.closeTime || null, storedStatus, exam.id),
    env.DB.prepare('DELETE FROM cbt_questions WHERE exam_id=?').bind(exam.id),
    ...questionStatements(env.DB, String(exam.id), body.questions),
  ];
  if (body.token) statements[0] = env.DB.prepare(`UPDATE cbt_exams SET title=?,subject=?,class_target=?,duration_minutes=?,start_date=?,end_date=?,open_time=?,close_time=?,status=?,token_hash=?,updated_at=datetime('now') WHERE id=?`).bind(body.title.trim(), body.subject.trim(), body.classTarget, body.durationMinutes, body.startDate, body.endDate, body.openTime || null, body.closeTime || null, storedStatus, await hashCbtToken(body.token), exam.id);
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (String(error).includes('CBT_EXAM_ALREADY_STARTED')) {
      return jsonResponse({ success: false, error: 'Paket soal tidak dapat diedit setelah ujian mulai dikerjakan.' }, 409);
    }
    throw error;
  }
  return jsonResponse({ success: true, data: { ...body, id: String(exam.id), teacherName: String(exam.teacher_name), token: body.token ? body.token.trim().toUpperCase() : '', status: responseStatus } });
};

export const onRequestDelete: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const exam = await env.DB.prepare('SELECT * FROM cbt_exams WHERE id=?').bind(String(body.id || '')).first<any>();
  if (!exam) return jsonResponse({ success: false, error: 'Ujian tidak ditemukan.' }, 404);
  if (!canManageCbtExam(data.user, exam)) return jsonResponse({ success: false, error: 'Anda hanya dapat menghapus ujian milik sendiri.' }, 403);
  const attempt = await env.DB.prepare('SELECT id FROM cbt_attempts WHERE exam_id=? LIMIT 1').bind(exam.id).first();
  if (attempt) return jsonResponse({ success: false, error: 'Ujian yang sudah memiliki pengerjaan tidak dapat dihapus. Nonaktifkan atau selesaikan ujian.' }, 409);
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM cbt_questions WHERE exam_id=?').bind(exam.id),
      env.DB.prepare('DELETE FROM cbt_exams WHERE id=?').bind(exam.id),
    ]);
  } catch (error) {
    if (String(error).includes('CBT_EXAM_ALREADY_STARTED')) {
      return jsonResponse({ success: false, error: 'Ujian yang sudah memiliki pengerjaan tidak dapat dihapus.' }, 409);
    }
    throw error;
  }
  return jsonResponse({ success: true, data: { id: String(exam.id) } });
};

async function validClassTarget(db: D1Database, target: unknown): Promise<boolean> {
  if (target === 'all' || target === 'Semua Kelas MPLB') return true;
  if (typeof target !== 'string' || !target || target.length > 100) return false;
  const row = await db.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first<{ value: string }>();
  return parseJson<any[]>(row?.value, []).some(item => item?.id === target || item?.name === target);
}

function questionStatements(db: D1Database, examId: string, questions: any[]) {
  return questions.map((question, index) => db.prepare(`INSERT INTO cbt_questions (exam_id,id,position,question,question_type,options_json,correct_answer,explanation) VALUES (?,?,?,?,?,?,?,?)`).bind(examId, question.id.trim(), index, question.question.trim(), question.type === 'essai' ? 'essai' : 'pg', JSON.stringify((question.options || []).map((option: any) => ({ key: option.key, text: option.text.trim() }))), question.type === 'essai' ? String(question.correctAnswer).trim() : question.correctAnswer, question.explanation ? String(question.explanation).slice(0, 2000) : null));
}
