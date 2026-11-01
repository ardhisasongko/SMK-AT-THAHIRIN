import { verifyPassword, type AuthUser } from '../../../_lib/auth';
import { jsonResponse } from '../../../_lib/response';
import { writeUserAudit } from '../../../_lib/user-audit';
import {
  decryptTotpSecret, isTotpConfigured, TWO_FACTOR_ROLES, verifyTotp, type TotpEnv,
} from '../../../_lib/totp';

interface Env extends TotpEnv { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

/**
 * Nonaktifkan 2FA oleh pemilik akun sendiri. Wajib bukti kepemilikan faktor
 * kedua (kode TOTP saat ini) ATAU password akun. Membersihkan secret, kode
 * pemulihan, dan tantangan yang menggantung; tercatat di audit pengguna.
 */
export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  const user = data.user;
  if (!user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!(TWO_FACTOR_ROLES as readonly string[]).includes(user.role)) {
    return jsonResponse({ success: false, error: 'Verifikasi dua langkah hanya untuk akun guru dan administrator.' }, 403);
  }
  let body: { code?: string; currentPassword?: string };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const row = await env.DB.prepare('SELECT password_hash, totp_secret_enc, totp_enabled FROM users WHERE id = ?').bind(user.id).first<any>();
  if (Number(row?.totp_enabled || 0) !== 1) {
    return jsonResponse({ success: false, error: 'Verifikasi dua langkah belum aktif.' }, 409);
  }
  let proven = false;
  if (typeof body.code === 'string' && /^\d{6}$/.test(body.code.replace(/\s/g, '')) && isTotpConfigured(env) && row?.totp_secret_enc) {
    const secret = await decryptTotpSecret(env, String(row.totp_secret_enc));
    if (secret !== null) proven = (await verifyTotp(secret, body.code)) !== null;
  }
  if (!proven && typeof body.currentPassword === 'string' && body.currentPassword) {
    proven = await verifyPassword(body.currentPassword, String(row?.password_hash || ''));
  }
  if (!proven) {
    return jsonResponse({ success: false, error: 'Bukti verifikasi tidak valid. Masukkan kode authenticator atau password Anda.' }, 401);
  }
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET totp_secret_enc = NULL, totp_enabled = 0 WHERE id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM totp_recovery_codes WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM auth_challenges WHERE user_id = ?').bind(user.id),
  ]);
  await writeUserAudit(env.DB, user, 'DISABLE_2FA_SELF', { id: user.id, name: user.name }, { totpEnabled: true }, { totpEnabled: false });
  return jsonResponse({ success: true, data: { enabled: false } });
};
