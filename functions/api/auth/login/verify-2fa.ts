import { createSession } from '../../../_lib/auth';
import { jsonResponse } from '../../../_lib/response';
import { consumeRateLimit } from '../../../_lib/rate-limit';
import { normalizeRecoveryCode, sha256Hex, verifyTotp, decryptTotpSecret, type TotpEnv } from '../../../_lib/totp';

interface Env extends TotpEnv { DB: D1Database }

const MAX_CHALLENGE_ATTEMPTS = 5;

function sessionCookie(request: Request, token: string): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `smk_session=${token}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=604800`;
}

function publicUser(row: any) {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    nipNisn: row.nip_nisn != null ? String(row.nip_nisn) : null,
    nik: row.nik != null ? String(row.nik) : null,
    tanggalLahir: row.tanggal_lahir != null ? String(row.tanggal_lahir) : null,
    classId: row.class_id != null ? String(row.class_id) : null,
    ketuaStatus: String(row.ketua_status || 'none'),
    jabatan: row.jabatan != null ? String(row.jabatan) : null,
    status: String(row.status || 'active'),
    mustChangePassword: Number(row.must_change_password || 0) === 1,
  };
}

/**
 * Langkah kedua login: tukar token tantangan + kode TOTP / kode pemulihan
 * menjadi sesi penuh. Token tantangan BUKAN sesi — ia tidak diterima
 * getUserFromRequest, sehingga tidak dapat dipakai mengakses API lain.
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: { challengeToken?: string; code?: string };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!challengeToken || !code) {
    return jsonResponse({ success: false, error: 'Token tantangan dan kode verifikasi wajib diisi.' }, 400);
  }
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await consumeRateLimit(env.DB, `2fa-verify-ip:${clientIp}`, 30, 10 * 60))) {
    return jsonResponse({ success: false, error: 'Terlalu banyak percobaan verifikasi. Coba lagi beberapa menit.' }, 429);
  }

  const tokenHash = await sha256Hex(challengeToken);
  const challenge = await env.DB.prepare(
    'SELECT token_hash, user_id, attempts, expires_at FROM auth_challenges WHERE token_hash = ?'
  ).bind(tokenHash).first<any>();
  const fail = async (status = 401) => {
    if (challenge) {
      const attempts = Number(challenge.attempts || 0) + 1;
      if (attempts >= MAX_CHALLENGE_ATTEMPTS) {
        await env.DB.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').bind(tokenHash).run();
      } else {
        await env.DB.prepare('UPDATE auth_challenges SET attempts = ? WHERE token_hash = ?').bind(attempts, tokenHash).run();
      }
    }
    return jsonResponse({ success: false, error: 'Kode verifikasi salah atau sudah tidak berlaku.' }, status);
  };
  if (!challenge) return jsonResponse({ success: false, error: 'Kode verifikasi salah atau sudah tidak berlaku.' }, 401);
  if (new Date(String(challenge.expires_at)).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').bind(tokenHash).run();
    return jsonResponse({ success: false, error: 'Kode verifikasi salah atau sudah tidak berlaku.' }, 401);
  }

  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(String(challenge.user_id)).first<any>();
  if (!row || String(row.status || 'active') !== 'active' || Number(row.totp_enabled || 0) !== 1 || !row.totp_secret_enc) {
    await env.DB.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').bind(tokenHash).run();
    return jsonResponse({ success: false, error: 'Kode verifikasi salah atau sudah tidak berlaku.' }, 401);
  }

  let verified = false;
  if (/^\d{6}$/.test(code.replace(/\s/g, ''))) {
    const secret = await decryptTotpSecret(env, String(row.totp_secret_enc));
    if (secret === null) {
      // Secret server untuk membuka enkripsi tidak tersedia/kunci berubah:
      // gagal tertutup dengan pesan yang dapat ditindaklanjuti admin.
      console.error('TOTP_ENCRYPTION_KEY tidak tersedia atau tidak cocok untuk membuka secret 2FA.');
      return jsonResponse({ success: false, error: 'Konfigurasi keamanan server belum lengkap. Hubungi administrator.' }, 503);
    }
    verified = (await verifyTotp(secret, code)) !== null;
  } else {
    const codeHash = await sha256Hex(normalizeRecoveryCode(code));
    const recovery = await env.DB.prepare(
      'SELECT id FROM totp_recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL'
    ).bind(String(row.id), codeHash).first<any>();
    if (recovery) {
      await env.DB.prepare('UPDATE totp_recovery_codes SET used_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), String(recovery.id)).run();
      verified = true;
    }
  }
  if (!verified) return fail();

  await env.DB.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').bind(tokenHash).run();
  const token = await createSession(env, String(row.id));
  const response = jsonResponse({ success: true, user: publicUser(row) });
  response.headers.set('Set-Cookie', sessionCookie(request, token));
  return response;
};
