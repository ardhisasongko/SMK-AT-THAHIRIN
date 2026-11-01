import type { AuthUser } from '../../../../_lib/auth';
import { getExamQuestions, isCbtReviewUnlocked, isCbtStudent, parseEssayScores, parseJson } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

// Pembahasan pasca-ujian untuk siswa: kunci + penjelasan per soal HANYA untuk
// attempt milik siswa sendiri yang SUDAH submitted, dan hanya setelah gerbang
// "seluruh peserta selesai" terbuka (isCbtReviewUnlocked) — selama gerbang
// tertutup server TIDAK mengirim data per soal sama sekali, hanya ringkasan
// hasil siswa sendiri + penanda reviewLocked. Selama attempt masih
// in_progress/expired endpoint ini menolak — kunci tidak boleh bocor.
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStudent(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  const attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE id=? AND student_user_id=?').bind(String(params.id), data.user.id).first<any>();
  if (!attempt) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
  if (attempt.status !== 'submitted') return jsonResponse({ success: false, error: 'Pembahasan tersedia setelah ujian selesai dikirim.' }, 403);

  const exam = await env.DB.prepare('SELECT * FROM cbt_exams WHERE id=?').bind(String(attempt.exam_id)).first<any>();
  if (!exam) return jsonResponse({ success: false, error: 'Ujian tidak ditemukan.' }, 404);
  const essayScores = parseEssayScores(attempt.essay_scores_json);
  const gradingStatus = attempt.grading_status === 'pending_grading' ? 'pending_grading' : 'graded';
  const submission = {
    id: String(attempt.id), examId: String(attempt.exam_id), siswaId: String(attempt.student_user_id),
    siswaName: String(attempt.student_name), nisn: String(attempt.nisn),
    answers: parseJson(attempt.answers_json, {}), doubtful: parseJson(attempt.doubtful_json, {}),
    score: Number(attempt.score || 0), correctCount: Number(attempt.correct_count || 0), wrongCount: Number(attempt.wrong_count || 0),
    submittedAt: attempt.submitted_at ? String(attempt.submitted_at) : '', timeSpentSeconds: Number(attempt.time_spent_seconds || 0),
    gradingStatus,
    pgScore: attempt.pg_score != null ? Number(attempt.pg_score) : Number(attempt.score || 0),
    essayScores: essayScores.scores, essayNotes: essayScores.notes,
  };

  // Gerbang seluruh-peserta-selesai: selama tertutup, kunci & pembahasan
  // tidak dikirim sama sekali (bukan sekadar disembunyikan di UI).
  if (!(await isCbtReviewUnlocked(env.DB, exam))) {
    return jsonResponse({ success: true, data: { reviewLocked: 'waiting_all_students', submission } });
  }

  // Urutan soal ASLI (tidak diacak) agar review mudah diikuti; jawaban siswa
  // tersimpan sebagai kunci asal sehingga konsisten dengan kunci di sini.
  const questions = await getExamQuestions(env.DB, String(attempt.exam_id), true);

  return jsonResponse({
    success: true,
    data: {
      exam: {
        id: String(exam.id), title: String(exam.title), subject: String(exam.subject), classTarget: String(exam.class_target),
        durationMinutes: Number(exam.duration_minutes), token: '', teacherName: String(exam.teacher_name),
        startDate: String(exam.start_date), endDate: String(exam.end_date), openTime: exam.open_time || '', closeTime: exam.close_time || '',
        examType: String(exam.exam_type || 'latihan'), status: 'completed', questions,
      },
      submission,
    },
  });
};
