import type { AuthUser } from '../../../../../_lib/auth';
import {
  PROCTOR_FLAG_TAB_SWITCHES,
  canManageCbtExam,
  countAnsweredQuestions,
  effectiveCbtStatus,
  getExamQuestions,
  getExamRoster,
  gradingStatusOf,
  isCbtStaff,
  parseJson,
  parseProctorEvents,
  scoreCbtAnswers,
} from '../../../../../_lib/cbt';
import { jsonResponse } from '../../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

// Ruang Kontrol Ujian — paket monitor untuk polling pengawas (guru pemilik /
// admin). Satu respons hemat-kueri berisi ringkasan ujian + SELURUH roster
// kelas target (termasuk siswa yang belum mulai) dengan progres, sisa waktu,
// nilai sementara/final, dan counter proctoring per attempt. Nilai sementara
// dihitung SERVER dari jawaban autosave vs kunci PG — kunci & pembahasan
// TIDAK PERNAH disertakan di respons ini.
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  const exam = await env.DB.prepare('SELECT * FROM cbt_exams WHERE id=?').bind(String(params.id)).first<any>();
  if (!exam) return jsonResponse({ success: false, error: 'Ujian tidak ditemukan.' }, 404);
  if (!canManageCbtExam(data.user, exam)) return jsonResponse({ success: false, error: 'Anda hanya dapat memantau ujian milik sendiri.' }, 403);

  const examId = String(exam.id);
  // Kueri dibatasi jumlahnya (anti N+1): soal sekali, attempt sekali, autosave
  // sekali (hanya attempt berjalan), roster sekali — sisanya dihitung di memori.
  const [questions, attemptRows, autosaveRows, roster] = await Promise.all([
    getExamQuestions(env.DB, examId, true),
    env.DB.prepare('SELECT * FROM cbt_attempts WHERE exam_id=?').bind(examId).all<any>().then(rows => rows.results as any[]),
    env.DB.prepare(`SELECT saved.attempt_id, saved.answers_json, saved.saved_at FROM cbt_attempt_answers saved
      JOIN cbt_attempts attempts ON attempts.id = saved.attempt_id
      WHERE attempts.exam_id=? AND attempts.status='in_progress'`).bind(examId).all<any>().then(rows => rows.results as any[]),
    getExamRoster(env.DB, exam),
  ]);

  const totalQuestions = questions.length;
  const essayTotal = questions.filter(question => question.type === 'essai').length;
  const attemptsByStudent = new Map<string, any>();
  for (const attempt of attemptRows) attemptsByStudent.set(String(attempt.student_user_id), attempt);
  const autosaveByAttempt = new Map<string, any>();
  for (const saved of autosaveRows) autosaveByAttempt.set(String(saved.attempt_id), saved);

  const nowMs = Date.now();
  const counts = { notStarted: 0, inProgress: 0, submitted: 0, expired: 0, flagged: 0 };
  let submittedFinalScoreSum = 0;
  let submittedFinalCount = 0;
  let provisionalScoreSum = 0;
  let provisionalCount = 0;

  const students = roster.map(student => {
    const attempt = attemptsByStudent.get(student.id) || null;
    const base = {
      studentId: student.id,
      name: student.name,
      nisn: student.nisn,
      className: student.className,
      attemptId: attempt ? String(attempt.id) : null,
    };
    if (!attempt) {
      counts.notStarted += 1;
      return {
        ...base,
        status: 'not_started' as const,
        answeredCount: 0,
        totalQuestions,
        progressPercent: 0,
        remainingSeconds: null as number | null,
        lastActivityAt: null as string | null,
        provisionalScore: null as number | null,
        finalScore: null as number | null,
        gradingStatus: null as 'pending_grading' | 'graded' | null,
        hasEssayPending: false,
        submittedBy: null as 'student' | 'proctor' | null,
        proctor: { tabSwitch: 0, windowBlur: 0, fullscreenExit: 0 },
        flagged: false,
      };
    }

    const proctor = parseProctorEvents(attempt.proctor_events_json);
    const flagged = proctor.tabSwitch >= PROCTOR_FLAG_TAB_SWITCHES;
    if (flagged) counts.flagged += 1;
    const rawStatus = String(attempt.status || '');
    // Attempt in_progress yang batas waktunya sudah lewat diperlakukan expired
    // untuk tampilan (tanpa menulis status di jalur baca ini).
    const status = rawStatus === 'in_progress' && String(attempt.expires_at || '') && new Date(String(attempt.expires_at)).getTime() + 30_000 < nowMs
      ? 'expired'
      : rawStatus;

    if (status === 'in_progress') {
      counts.inProgress += 1;
      const saved = autosaveByAttempt.get(String(attempt.id));
      const answers = parseJson<Record<string, string>>(saved?.answers_json, {});
      const answeredCount = countAnsweredQuestions(questions, answers);
      // Nilai sementara terakumulasi: PG saja, dari jawaban AUTOSAVE terakhir
      // memakai penilaian resmi yang sama (scoreCbtAnswers) — konsisten dengan
      // nilai final bila jawaban tidak berubah sampai submit.
      const provisional = scoreCbtAnswers(questions, answers);
      provisionalScoreSum += provisional.pgScore;
      provisionalCount += 1;
      return {
        ...base,
        status: 'in_progress' as const,
        answeredCount,
        totalQuestions,
        progressPercent: totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0,
        remainingSeconds: Math.max(0, Math.round((new Date(String(attempt.expires_at)).getTime() - nowMs) / 1000)),
        lastActivityAt: saved?.saved_at ? String(saved.saved_at) : String(attempt.started_at || ''),
        provisionalScore: provisional.pgScore,
        finalScore: null as number | null,
        gradingStatus: null as 'pending_grading' | 'graded' | null,
        hasEssayPending: essayTotal > 0,
        submittedBy: null as 'student' | 'proctor' | null,
        proctor,
        flagged,
      };
    }

    if (status === 'submitted') {
      counts.submitted += 1;
      const answers = parseJson<Record<string, string>>(attempt.answers_json, {});
      const answeredCount = countAnsweredQuestions(questions, answers);
      const gradingStatus = gradingStatusOf(attempt);
      const finalScore = gradingStatus === 'graded' ? Number(attempt.score || 0) : null;
      if (finalScore != null) { submittedFinalScoreSum += finalScore; submittedFinalCount += 1; }
      return {
        ...base,
        status: 'submitted' as const,
        answeredCount,
        totalQuestions,
        progressPercent: totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0,
        remainingSeconds: null as number | null,
        lastActivityAt: attempt.submitted_at ? String(attempt.submitted_at) : null,
        provisionalScore: attempt.pg_score != null ? Number(attempt.pg_score) : null,
        finalScore,
        gradingStatus,
        hasEssayPending: gradingStatus === 'pending_grading',
        submittedBy: attempt.submitted_by === 'proctor' ? 'proctor' as const : 'student' as const,
        proctor,
        flagged,
      };
    }

    counts.expired += 1;
    return {
      ...base,
      status: 'expired' as const,
      answeredCount: 0,
      totalQuestions,
      progressPercent: 0,
      remainingSeconds: 0,
      lastActivityAt: attempt.submitted_at ? String(attempt.submitted_at) : String(attempt.expires_at || ''),
      provisionalScore: null as number | null,
      finalScore: null as number | null,
      gradingStatus: null as 'pending_grading' | 'graded' | null,
      hasEssayPending: false,
      submittedBy: null as 'student' | 'proctor' | null,
      proctor,
      flagged,
    };
  });

  // Pengumuman terbaru (riwayat singkat untuk panel operator).
  const { results: announcementRows } = await env.DB.prepare(
    'SELECT id, author_name, message, created_at FROM cbt_exam_announcements WHERE exam_id=? ORDER BY created_at DESC LIMIT 10'
  ).bind(examId).all<any>();

  const averageOf = (sum: number, count: number) => (count > 0 ? Math.round((sum / count) * 10) / 10 : null);

  return jsonResponse({
    success: true,
    data: {
      exam: {
        id: examId,
        title: String(exam.title),
        subject: String(exam.subject),
        classTarget: String(exam.class_target),
        durationMinutes: Number(exam.duration_minutes),
        totalQuestions,
        essayCount: essayTotal,
        startDate: String(exam.start_date),
        endDate: String(exam.end_date),
        openTime: exam.open_time || null,
        closeTime: exam.close_time || null,
        status: effectiveCbtStatus(exam),
        examType: String(exam.exam_type || 'latihan'),
      },
      summary: {
        totalStudents: roster.length,
        notStarted: counts.notStarted,
        inProgress: counts.inProgress,
        submitted: counts.submitted,
        expired: counts.expired,
        flagged: counts.flagged,
        averageProvisionalScore: averageOf(provisionalScoreSum, provisionalCount),
        averageFinalScore: averageOf(submittedFinalScoreSum, submittedFinalCount),
      },
      students,
      announcements: (announcementRows as any[]).map(row => ({
        id: String(row.id),
        authorName: String(row.author_name),
        message: String(row.message),
        createdAt: String(row.created_at),
      })),
      serverTime: new Date().toISOString(),
    },
  });
};
