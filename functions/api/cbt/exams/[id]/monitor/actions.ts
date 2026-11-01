import type { AuthUser } from '../../../../../_lib/auth';
import {
  canManageCbtExam,
  finalizeCbtAttempt,
  isCbtStaff,
  parseJson,
  sanitizeAnnouncementMessage,
} from '../../../../../_lib/cbt';
import { jsonResponse } from '../../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

const EXTEND_MINUTES = [5, 10, 15];

// Kendali Ruang Kontrol — semua aksi hanya untuk pengelola ujian
// (canManageCbtExam) dan SELALU tercatat di cbt_monitor_actions sebagai audit:
//   announcement : siaran pesan ke semua runner aktif ujian (attempt_id NULL).
//   extend_time  : tambah menit (5/10/15) ke expires_at satu attempt berjalan,
//                  atau semua attempt berjalan bila attemptId kosong.
//   force_submit : menyelesaikan satu attempt berjalan SEKARANG dari jawaban
//                  autosave terakhir (fallback snapshot attempt) lewat jalur
//                  penilaian resmi finalizeCbtAttempt, berpenanda proctor.
//                  Aturan waktu-minimal-kirim sengaja diabaikan (wewenang
//                  pengawas), tetapi attempt yang sudah expired ditolak.
export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  const exam = await env.DB.prepare('SELECT * FROM cbt_exams WHERE id=?').bind(String(params.id)).first<any>();
  if (!exam) return jsonResponse({ success: false, error: 'Ujian tidak ditemukan.' }, 404);
  if (!canManageCbtExam(data.user, exam)) return jsonResponse({ success: false, error: 'Anda hanya dapat mengendalikan ujian milik sendiri.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const examId = String(exam.id);
  const actor = data.user;
  const audit = async (attemptId: string | null, action: string, detail: Record<string, unknown>) => {
    await env.DB.prepare('INSERT INTO cbt_monitor_actions (id, exam_id, attempt_id, actor_user_id, actor_name, action, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), examId, attemptId, actor.id, actor.name, action, JSON.stringify(detail)).run();
  };

  if (body?.action === 'announcement') {
    const parsed = sanitizeAnnouncementMessage(body.message);
    if ('error' in parsed) return jsonResponse({ success: false, error: parsed.error }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO cbt_exam_announcements (id, exam_id, author_user_id, author_name, message) VALUES (?, ?, ?, ?, ?)')
      .bind(id, examId, actor.id, actor.name, parsed.message).run();
    const created = await env.DB.prepare('SELECT created_at FROM cbt_exam_announcements WHERE id=?').bind(id).first<{ created_at: string }>();
    await audit(null, 'announcement', { announcementId: id, message: parsed.message });
    return jsonResponse({ success: true, data: { id, message: parsed.message, createdAt: created?.created_at || new Date().toISOString() } });
  }

  if (body?.action === 'extend_time') {
    const minutes = Number(body.minutes);
    if (!EXTEND_MINUTES.includes(minutes)) return jsonResponse({ success: false, error: 'Tambahan waktu hanya boleh 5, 10, atau 15 menit.' }, 400);
    const extendAttempt = async (attempt: any) => {
      const newExpires = new Date(new Date(String(attempt.expires_at)).getTime() + minutes * 60_000).toISOString();
      await env.DB.prepare("UPDATE cbt_attempts SET expires_at=? WHERE id=? AND status='in_progress'").bind(newExpires, attempt.id).run();
      await audit(String(attempt.id), 'extend_time', { minutes, previousExpiresAt: String(attempt.expires_at), newExpiresAt: newExpires, studentUserId: String(attempt.student_user_id), studentName: String(attempt.student_name) });
      return { attemptId: String(attempt.id), studentName: String(attempt.student_name), expiresAt: newExpires };
    };
    if (body.attemptId) {
      const attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE id=? AND exam_id=?').bind(String(body.attemptId), examId).first<any>();
      if (!attempt) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
      if (attempt.status !== 'in_progress') return jsonResponse({ success: false, error: 'Hanya attempt yang sedang berjalan yang bisa ditambah waktunya.' }, 409);
      const extended = await extendAttempt(attempt);
      return jsonResponse({ success: true, data: { extended: [extended] } });
    }
    const { results } = await env.DB.prepare("SELECT * FROM cbt_attempts WHERE exam_id=? AND status='in_progress'").bind(examId).all<any>();
    const extended = [];
    for (const attempt of results as any[]) extended.push(await extendAttempt(attempt));
    return jsonResponse({ success: true, data: { extended } });
  }

  if (body?.action === 'force_submit') {
    if (!body.attemptId) return jsonResponse({ success: false, error: 'attemptId wajib diisi untuk paksa kumpul.' }, 400);
    const attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE id=? AND exam_id=?').bind(String(body.attemptId), examId).first<any>();
    if (!attempt) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
    if (attempt.status === 'submitted') return jsonResponse({ success: false, error: 'Attempt ini sudah dikumpulkan.' }, 409);
    if (attempt.status !== 'in_progress') return jsonResponse({ success: false, error: 'Attempt ini sudah tidak aktif dan tidak bisa dipaksa kumpul.' }, 409);
    // Attempt yang jendelanya sudah lewat (expired) tidak boleh dipaksa kumpul.
    if (Date.now() > new Date(String(attempt.expires_at)).getTime() + 30_000) {
      return jsonResponse({ success: false, error: 'Waktu attempt ini sudah berakhir (kedaluwarsa) sehingga tidak bisa dipaksa kumpul.' }, 409);
    }
    // Jawaban dari autosave terakhir; bila autosave kosong, fallback snapshot attempt.
    const saved = await env.DB.prepare('SELECT answers_json, doubtful_json FROM cbt_attempt_answers WHERE attempt_id=?').bind(String(attempt.id)).first<any>();
    const savedAnswers = parseJson<Record<string, string>>(saved?.answers_json, {});
    const answers = Object.keys(savedAnswers).length > 0 ? savedAnswers : parseJson<Record<string, string>>(attempt.answers_json, {});
    const doubtful = Object.keys(savedAnswers).length > 0 ? parseJson<Record<string, boolean>>(saved?.doubtful_json, {}) : parseJson<Record<string, boolean>>(attempt.doubtful_json, {});
    const result = await finalizeCbtAttempt(env.DB, attempt, answers, doubtful, 'proctor');
    await audit(String(attempt.id), 'force_submit', {
      studentUserId: String(attempt.student_user_id),
      studentName: String(attempt.student_name),
      score: result.score,
      pgScore: result.pgScore,
      gradingStatus: result.gradingStatus,
      answeredFromAutosave: Object.keys(savedAnswers).length > 0,
    });
    return jsonResponse({ success: true, data: { attemptId: String(attempt.id), studentName: String(attempt.student_name), score: result.score, pgScore: result.pgScore, gradingStatus: result.gradingStatus, submittedBy: 'proctor', submittedAt: result.submittedAt } });
  }

  return jsonResponse({ success: false, error: 'Aksi tidak dikenal. Gunakan announcement, extend_time, atau force_submit.' }, 400);
};
