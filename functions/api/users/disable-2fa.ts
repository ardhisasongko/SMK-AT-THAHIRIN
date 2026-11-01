import { type AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { writeUserAudit } from '../../_lib/user-audit';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

/**
 * Nonaktifkan 2FA pengguna lain oleh administrator — jalan pemulihan resmi
 * bagi staf yang kehilangan aplikasi authenticator sekaligus kode
 * pemulihannya. Admin tidak boleh menyentuh akun admin/super_admin lain
 * (pola yang sama dengan reset password); super_admin boleh untuk semua
 * akun staf. Tindakan tercatat di audit dan seluruh sesi target dicabut
 * agar target wajib login ulang dari awal.
 */
export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  const actor = data.user;
  if (!actor || !['super_admin', 'admin'].includes(actor.role)) {
    return jsonResponse({ success: false, error: 'Akses khusus administrator.' }, 403);
  }
  let body: { id?: string; reason?: string };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (!body.id) return jsonResponse({ success: false, error: 'ID pengguna wajib diisi.' }, 400);
  const target = await env.DB.prepare('SELECT id, name, role, totp_enabled FROM users WHERE id = ?').bind(body.id).first<any>();
  if (!target) return jsonResponse({ success: false, error: 'Pengguna tidak ditemukan.' }, 404);
  if (actor.role === 'admin' && String(target.role) !== 'guru') {
    return jsonResponse({ success: false, error: 'Admin hanya dapat menonaktifkan 2FA akun guru.' }, 403);
  }
  if (Number(target.totp_enabled || 0) !== 1) {
    return jsonResponse({ success: false, error: 'Verifikasi dua langkah pengguna ini belum aktif.' }, 409);
  }
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET totp_secret_enc = NULL, totp_enabled = 0 WHERE id = ?').bind(body.id),
    env.DB.prepare('DELETE FROM totp_recovery_codes WHERE user_id = ?').bind(body.id),
    env.DB.prepare('DELETE FROM auth_challenges WHERE user_id = ?').bind(body.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.id),
  ]);
  await writeUserAudit(
    env.DB, actor, 'DISABLE_2FA',
    { id: String(target.id), name: String(target.name) },
    { totpEnabled: true }, { totpEnabled: false }, body.reason,
  );
  return jsonResponse({ success: true });
};
