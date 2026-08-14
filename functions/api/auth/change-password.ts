import { hashPassword, verifyPassword, type AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  let body: { currentPassword?: string; newPassword?: string };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string' || body.newPassword.length < 8 || body.newPassword.length > 200) {
    return jsonResponse({ success: false, error: 'Password baru minimal 8 karakter.' }, 400);
  }
  const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(data.user.id).first();
  if (!row || !(await verifyPassword(body.currentPassword, String(row.password_hash)))) {
    return jsonResponse({ success: false, error: 'Password saat ini salah.' }, 401);
  }
  await env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .bind(await hashPassword(body.newPassword), data.user.id).run();
  const auth = request.headers.get('Authorization') || '';
  const currentToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (currentToken) {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').bind(data.user.id, currentToken).run();
  } else {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(data.user.id).run();
  }
  return jsonResponse({ success: true });
};
