import { deleteOtherSessions, type AuthUser } from '../../../_lib/auth';
import { jsonResponse } from '../../../_lib/response';
import { consumeRateLimit } from '../../../_lib/rate-limit';
import {
  decryptTotpSecret, generateRecoveryCode, isTotpConfigured, sha256Hex,
  TWO_FACTOR_ROLES, verifyTotp, type TotpEnv,
} from '../../../_lib/totp';

interface Env extends TotpEnv { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

const RECOVERY_CODE_COUNT = 10;

/**
 * Langkah 2 aktivasi 2FA: pengguna membuktikan memegang secret tertunda
 * dengan kode pertama dari aplikasi authenticator. Setelah aktif:
 * - 10 kode pemulihan sekali pakai dibuat (plaintext hanya di respons ini,
 *   di database hanya hash SHA-256),
 * - semua sesi LAIN pengguna dicabut agar sesi pra-2FA tidak menjadi
 *   jalan pintas melewati verifikasi kedua.
 */
export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  const user = data.user;
  if (!user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!(TWO_FACTOR_ROLES as readonly string[]).includes(user.role)) {
    return jsonResponse({ success: false, error: 'Verifikasi dua langkah hanya untuk akun guru dan administrator.' }, 403);
  }
  if (!isTotpConfigured(env)) {
    return jsonResponse({ success: false, error: 'Fitur verifikasi dua langkah belum dikonfigurasi di server.' }, 503);
  }
  if (!(await consumeRateLimit(env.DB, `2fa-activate:${user.id}`, 10, 10 * 60))) {
    return jsonResponse({ success: false, error: 'Terlalu banyak percobaan aktivasi. Coba lagi beberapa menit.' }, 429);
  }
  let body: { code?: string };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const code = typeof body.code === 'string' ? body.code : '';
  const row = await env.DB.prepare('SELECT totp_secret_enc, totp_enabled FROM users WHERE id = ?').bind(user.id).first<any>();
  if (!row?.totp_secret_enc) {
    return jsonResponse({ success: false, error: 'Siapkan dulu verifikasi dua langkah sebelum aktivasi.' }, 409);
  }
  if (Number(row.totp_enabled || 0) === 1) {
    return jsonResponse({ success: false, error: 'Verifikasi dua langkah sudah aktif.' }, 409);
  }
  const secret = await decryptTotpSecret(env, String(row.totp_secret_enc));
  if (secret === null) {
    console.error('Gagal membuka secret 2FA tertunda: TOTP_ENCRYPTION_KEY tidak cocok.');
    return jsonResponse({ success: false, error: 'Konfigurasi keamanan server belum lengkap. Hubungi administrator.' }, 503);
  }
  if ((await verifyTotp(secret, code)) === null) {
    return jsonResponse({ success: false, error: 'Kode verifikasi salah. Periksa kembali aplikasi authenticator Anda.' }, 401);
  }

  const recoveryCodes: string[] = [];
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM totp_recovery_codes WHERE user_id = ?').bind(user.id),
  ];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const codeText = generateRecoveryCode();
    recoveryCodes.push(codeText);
    statements.push(env.DB.prepare(
      'INSERT INTO totp_recovery_codes (id, user_id, code_hash) VALUES (?, ?, ?)'
    ).bind(`rc-${crypto.randomUUID()}`, user.id, await sha256Hex(codeText.replace(/-/g, ''))));
  }
  await env.DB.batch(statements);
  await deleteOtherSessions(env, user.id, request);
  return jsonResponse({ success: true, data: { enabled: true, recoveryCodes } });
};
