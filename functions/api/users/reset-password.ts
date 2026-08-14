import { hashPassword, type AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { writeUserAudit } from '../../_lib/user-audit';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  const actor = data.user;
  if (!actor || !['super_admin', 'admin'].includes(actor.role)) return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  let body: { id?: string };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const target = body.id ? await env.DB.prepare('SELECT id, name, role FROM users WHERE id = ?').bind(body.id).first() : null;
  if (!target) return jsonResponse({ success: false, error: 'Pengguna tidak ditemukan.' }, 404);
  if (actor.role === 'admin' && !['guru', 'siswa', 'ketua_kelas'].includes(String(target.role))) {
    return jsonResponse({ success: false, error: 'Admin tidak boleh mereset akun administrator.' }, 403);
  }
  const password = randomPassword();
  await env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
    .bind(await hashPassword(password), body.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.id).run();
  await writeUserAudit(env.DB, actor, 'RESET_PASSWORD', { id: String(target.id), name: String(target.name) });
  return jsonResponse({ success: true, initialPassword: password });
};
