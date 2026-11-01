import { createSession, hashPassword, verifyPassword, type AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { validateNewPassword } from '../../_lib/password-policy';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  let body: { currentPassword?: string; newPassword?: string };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
    return jsonResponse({ success: false, error: 'Password lama dan password baru wajib diisi.' }, 400);
  }
  // Kebijakan password tunggal (hardening Fase B) — berlaku di semua jalur,
  // termasuk penggantian password awal wajib: minimal 10 karakter huruf+angka
  // dan tidak boleh ditebak dari NISN/NIP, email, atau nama pengguna.
  const identityRow = await env.DB.prepare('SELECT nip_nisn FROM users WHERE id = ?').bind(data.user.id).first();
  const policyError = validateNewPassword(body.newPassword, {
    identifier: identityRow?.nip_nisn != null ? String(identityRow.nip_nisn) : data.user.nipNisn,
    email: data.user.email,
    name: data.user.name,
  });
  if (policyError) return jsonResponse({ success: false, error: policyError }, 400);
  const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(data.user.id).first();
  if (!row || !(await verifyPassword(body.currentPassword, String(row.password_hash)))) {
    return jsonResponse({ success: false, error: 'Password saat ini salah.' }, 401);
  }
  await env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .bind(await hashPassword(body.newPassword), data.user.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(data.user.id).run();
  const token = await createSession(env, data.user.id);
  const response = jsonResponse({ success: true });
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  response.headers.set('Set-Cookie', `smk_session=${token}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=604800`);
  return response;
};
