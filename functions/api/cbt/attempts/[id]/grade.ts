import type { AuthUser } from '../../../../_lib/auth';
import { canManageCbtExam, essayKeywordHint, getExamQuestions, isCbtStaff, isEssayAnswerCorrect, parseEssayScores, parseJson, pointPerQuestion, roundScore1 } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

async function loadAttemptAndExam(env: Env, attemptId: string) {
  const attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE id=?').bind(attemptId).first<any>();
  if (!attempt) return { attempt: null, exam: null };
  const exam = await env.DB.prepare('SELECT * FROM cbt_exams WHERE id=?').bind(String(attempt.exam_id)).first<any>();
  return { attempt, exam };
}

// Detail koreksi esai untuk staf: jawaban esai siswa berdampingan dengan kunci
// guru + petunjuk kata kunci (isEssayAnswerCorrect & essayKeywordHint hanya
// PETUNJUK non-mengikat — nilai resmi selalu dari guru).
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  const { attempt, exam } = await loadAttemptAndExam(env, String(params.id));
  if (!attempt || !exam) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
  if (!canManageCbtExam(data.user, exam)) return jsonResponse({ success: false, error: 'Anda hanya dapat mengoreksi ujian milik sendiri.' }, 403);
  if (attempt.status !== 'submitted') return jsonResponse({ success: false, error: 'Ujian belum dikirim siswa.' }, 409);

  const questions = await getExamQuestions(env.DB, String(attempt.exam_id), true);
  const answers = parseJson<Record<string, string>>(attempt.answers_json, {});
  const essayScores = parseEssayScores(attempt.essay_scores_json);
  const perQuestion = pointPerQuestion(questions.length);
  const essays = questions.filter(question => question.type === 'essai').map(question => {
    const studentAnswer = typeof answers[question.id] === 'string' ? answers[question.id] : '';
    const key = question.correctAnswer || '';
    return {
      questionId: question.id,
      question: question.question,
      studentAnswer,
      correctAnswer: key,
      explanation: question.explanation || '',
      maxScore: roundScore1(perQuestion),
      hint: { ...essayKeywordHint(studentAnswer, key), autoMatch: isEssayAnswerCorrect(studentAnswer, key) },
      score: essayScores.scores[question.id] ?? null,
      note: essayScores.notes[question.id] || '',
    };
  });

  return jsonResponse({
    success: true,
    data: {
      attemptId: String(attempt.id),
      examId: String(attempt.exam_id),
      examTitle: String(exam.title),
      subject: String(exam.subject),
      siswaId: String(attempt.student_user_id),
      siswaName: String(attempt.student_name),
      nisn: String(attempt.nisn),
      submittedAt: attempt.submitted_at ? String(attempt.submitted_at) : '',
      gradingStatus: attempt.grading_status === 'pending_grading' ? 'pending_grading' : 'graded',
      pgScore: attempt.pg_score != null ? Number(attempt.pg_score) : Number(attempt.score || 0),
      score: Number(attempt.score || 0),
      pointPerQuestion: roundScore1(perQuestion),
      essays,
    },
  });
};

// Simpan nilai esai guru. Boleh sebagian (tetap pending_grading); bila semua
// esai sudah bernilai -> final: score = pg_score + total nilai esai (dibulatkan).
export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const scores = body?.scores && typeof body.scores === 'object' && !Array.isArray(body.scores) ? body.scores : null;
  const notes = body?.notes && typeof body.notes === 'object' && !Array.isArray(body.notes) ? body.notes : {};
  if (!scores || Object.keys(scores).length === 0) return jsonResponse({ success: false, error: 'Nilai esai tidak valid.' }, 400);

  const { attempt, exam } = await loadAttemptAndExam(env, String(params.id));
  if (!attempt || !exam) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
  if (!canManageCbtExam(data.user, exam)) return jsonResponse({ success: false, error: 'Anda hanya dapat mengoreksi ujian milik sendiri.' }, 403);
  if (attempt.status !== 'submitted') return jsonResponse({ success: false, error: 'Ujian belum dikirim siswa.' }, 409);
  if (attempt.grading_status == null) return jsonResponse({ success: false, error: 'Attempt lama sudah final dengan penilaian sebelumnya dan tidak dikoreksi ulang.' }, 409);

  const questions = await getExamQuestions(env.DB, String(attempt.exam_id), true);
  const essayIds = new Set(questions.filter(question => question.type === 'essai').map(question => question.id));
  if (essayIds.size === 0) return jsonResponse({ success: false, error: 'Paket ini tidak memiliki soal esai.' }, 400);
  const perQuestion = pointPerQuestion(questions.length);

  const merged = parseEssayScores(attempt.essay_scores_json);
  for (const [questionId, raw] of Object.entries(scores)) {
    if (!essayIds.has(questionId)) return jsonResponse({ success: false, error: 'Nilai memuat soal yang bukan esai pada ujian ini.' }, 400);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > perQuestion + 0.001) return jsonResponse({ success: false, error: `Nilai esai harus antara 0 dan ${roundScore1(perQuestion)}.` }, 400);
    merged.scores[questionId] = roundScore1(value);
  }
  for (const [questionId, raw] of Object.entries(notes)) {
    if (!essayIds.has(questionId)) continue;
    if (typeof raw !== 'string' || raw.length > 500) return jsonResponse({ success: false, error: 'Catatan koreksi maksimal 500 karakter.' }, 400);
    if (raw.trim()) merged.notes[questionId] = raw.trim(); else delete merged.notes[questionId];
  }

  const complete = [...essayIds].every(id => Object.prototype.hasOwnProperty.call(merged.scores, id));
  const essayTotal = [...essayIds].reduce((sum, id) => sum + (merged.scores[id] || 0), 0);
  const gradedAt = new Date().toISOString();
  if (complete) {
    const finalScore = Math.round((attempt.pg_score != null ? Number(attempt.pg_score) : 0) + essayTotal);
    await env.DB.prepare(`UPDATE cbt_attempts SET essay_scores_json=?,grading_status='graded',graded_by=?,graded_at=?,score=? WHERE id=?`).bind(JSON.stringify(merged), data.user.id, gradedAt, finalScore, attempt.id).run();
    return jsonResponse({ success: true, data: { attemptId: String(attempt.id), gradingStatus: 'graded', pgScore: attempt.pg_score != null ? Number(attempt.pg_score) : 0, essayScores: merged.scores, essayNotes: merged.notes, score: finalScore, gradedAt } });
  }
  await env.DB.prepare(`UPDATE cbt_attempts SET essay_scores_json=? WHERE id=?`).bind(JSON.stringify(merged), attempt.id).run();
  return jsonResponse({ success: true, data: { attemptId: String(attempt.id), gradingStatus: 'pending_grading', pgScore: attempt.pg_score != null ? Number(attempt.pg_score) : 0, essayScores: merged.scores, essayNotes: merged.notes, score: Number(attempt.score || 0) } });
};
