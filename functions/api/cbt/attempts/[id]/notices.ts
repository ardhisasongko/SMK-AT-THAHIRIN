import type { AuthUser } from '../../../../_lib/auth';
import { isCbtStudent } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

// Kanal ringan runner siswa (±30 detik sekali selama attempt berjalan):
// - pengumuman pengawas terbaru untuk ujian attempt ini (runner menyaring yang
//   sudah ditutup siswa di sesi itu berdasarkan id),
// - expiresAt server terkini (timer runner menyesuaikan bila pengawas
//   menambah waktu),
// - status attempt (bila sudah diforce-submit pengawas, runner menutup dengan
//   layar selesai yang pantas — submittedBy 'proctor').
// Hanya siswa PEMILIK attempt yang boleh membaca; siswa lain 404.
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStudent(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  const attempt = await env.DB.prepare('SELECT id, exam_id, status, expires_at, submitted_at, submitted_by, score FROM cbt_attempts WHERE id=? AND student_user_id=?')
    .bind(String(params.id), data.user.id).first<any>();
  if (!attempt) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
  const { results } = await env.DB.prepare(
    'SELECT id, author_name, message, created_at FROM cbt_exam_announcements WHERE exam_id=? ORDER BY created_at DESC LIMIT 20'
  ).bind(String(attempt.exam_id)).all<any>();
  return jsonResponse({
    success: true,
    data: {
      attemptId: String(attempt.id),
      status: String(attempt.status),
      submittedBy: attempt.submitted_by === 'proctor' ? 'proctor' : 'student',
      expiresAt: String(attempt.expires_at),
      submittedAt: attempt.submitted_at ? String(attempt.submitted_at) : null,
      score: attempt.status === 'submitted' ? Number(attempt.score || 0) : null,
      announcements: (results as any[]).map(row => ({
        id: String(row.id),
        authorName: String(row.author_name),
        message: String(row.message),
        createdAt: String(row.created_at),
      })),
      serverTime: new Date().toISOString(),
    },
  });
};
