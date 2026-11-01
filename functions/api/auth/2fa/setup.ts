import { type AuthUser } from '../../../_lib/auth';
import { jsonResponse } from '../../../_lib/response';
import {
  buildOtpAuthUrl, encryptTotpSecret, generateTotpSecret, isTotpConfigured,
  TWO_FACTOR_ROLES, type TotpEnv,
} from '../../../_lib/totp';

interface Env extends TotpEnv { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

/**
 * Langkah 1 aktivasi 2FA: buat secret baru dan simpan TERENKRIPSI sebagai
 * secret tertunda (belum aktif). Secret plaintext hanya dikembalikan sekali
 * di respons ini agar pengguna memasukkannya ke aplikasi authenticator.
 * Aktivasi selesai lewat /api/auth/2fa/activate dengan bukti kode pertama.
 */
export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  const user = data.user;
  if (!user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!(TWO_FACTOR_ROLES as readonly string[]).includes(user.role)) {
    return jsonResponse({ success: false, error: 'Verifikasi dua langkah hanya untuk akun guru dan administrator.' }, 403);
  }
  if (!isTotpConfigured(env)) {
    return jsonResponse({ success: false, error: 'Fitur verifikasi dua langkah belum dikonfigurasi di server.' }, 503);
  }
  const row = await env.DB.prepare('SELECT totp_enabled FROM users WHERE id = ?').bind(user.id).first<any>();
  if (Number(row?.totp_enabled || 0) === 1) {
    return jsonResponse({ success: false, error: 'Verifikasi dua langkah sudah aktif. Nonaktifkan dulu bila ingin menyiapkan ulang.' }, 409);
  }
  const secret = generateTotpSecret();
  const encrypted = await encryptTotpSecret(env, secret);
  await env.DB.prepare('UPDATE users SET totp_secret_enc = ? WHERE id = ?').bind(encrypted, user.id).run();
  return jsonResponse({
    success: true,
    data: { secret, otpAuthUrl: buildOtpAuthUrl(env, user.email, secret) },
  });
};
