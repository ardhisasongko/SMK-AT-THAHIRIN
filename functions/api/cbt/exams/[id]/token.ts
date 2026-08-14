import type { AuthUser } from '../../../../_lib/auth';
import { hashCbtToken, isCbtStaff } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  const exam = await env.DB.prepare('SELECT teacher_user_id FROM cbt_exams WHERE id=?').bind(String(params.id)).first<any>();
  if (!exam) return jsonResponse({ success: false, error: 'Ujian tidak ditemukan.' }, 404);
  if (data.user.role === 'guru' && exam.teacher_user_id !== data.user.id) return jsonResponse({ success: false, error: 'Guru hanya dapat merotasi token ujian miliknya.' }, 403);
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  await env.DB.prepare("UPDATE cbt_exams SET token_hash=?,updated_at=datetime('now') WHERE id=?").bind(await hashCbtToken(token), String(params.id)).run();
  return jsonResponse({ success: true, data: { token } });
};
