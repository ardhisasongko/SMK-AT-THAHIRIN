import { verifyPassword, createSession, type AuthEnv } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { clearRateLimit, consumeRateLimit, rateLimitExceeded } from '../../_lib/rate-limit';
import { sha256Hex, TWO_FACTOR_ROLES } from '../../_lib/totp';
import {
  accountLockoutKey, clearLoginLockout, getLoginLockoutUntil, ipLockoutKey,
  recordLoginFailure, recordLoginFailureStat, ACCOUNT_FAILURE_THRESHOLD, IP_FAILURE_THRESHOLD,
} from '../../_lib/login-lockout';
import { isTurnstileEnabled, verifyTurnstileToken, type TurnstileEnv } from '../../_lib/turnstile';

interface Env extends AuthEnv, TurnstileEnv {}
const DUMMY_PASSWORD_HASH = 'pbkdf2$100000$4f4e4c5944554d4d5950415353574f52$416f812aa8e8077cf41a5f602ebd520c42b0f276d3439667bfc25e81ce26b8c7';

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: { identifier?: string; password?: string; turnstileToken?: string };
  try {
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > 8192) return jsonResponse({ success: false, error: 'Ukuran permintaan terlalu besar.' }, 413);
    const raw = await request.arrayBuffer();
    if (raw.byteLength > 8192) return jsonResponse({ success: false, error: 'Ukuran permintaan terlalu besar.' }, 413);
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return jsonResponse({ success: false, error: 'Body harus berupa JSON.' }, 400);
  }

  if (typeof body.identifier !== 'string' || typeof body.password !== 'string') {
    return jsonResponse({ success: false, error: 'Identifier dan password wajib berupa teks.' }, 400);
  }
  const identifier = body.identifier.trim();
  const password = body.password;
  if (!identifier || !password || identifier.length > 254 || password.length > 200) {
    return jsonResponse({ success: false, error: 'Identifier dan password wajib diisi.' }, 400);
  }
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const normalizedIdentifier = identifier.toLowerCase();
  const ipRateKey = `login-ip:${clientIp}`;
  const accountRateKey = `login-account:${normalizedIdentifier}`;
  // Ember IP hanya MENGHITUNG percobaan yang GAGAL (increment terjadi di
  // jalur gagal di bawah): pemeriksaan di sini membaca hitungan tanpa
  // menaikkannya, agar ratusan login BERHASIL dari sekolah di balik satu
  // NAT tidak menghabiskan jatah 500/15 menit (terbukti tertolak massal
  // pada uji beban 1.000 siswa). Ember akun tetap consume per percobaan
  // seperti sebelumnya dan dibersihkan saat login berhasil.
  if (await rateLimitExceeded(env.DB, ipRateKey, 500)) {
    return jsonResponse({ success: false, error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' }, 429);
  }
  if (!(await consumeRateLimit(env.DB, accountRateKey, 10, 15 * 60))) {
    return jsonResponse({ success: false, error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' }, 429);
  }

  // Hardening Fase C(2): lockout bertahap per akun + per IP. Akun/IP yang
  // sedang terkunci ditolak SEBELUM verifikasi password — password yang
  // benar pun tidak diterima sampai kunci berakhir / admin mereset akun.
  const accountLockKey = accountLockoutKey(identifier);
  const ipLockKey = ipLockoutKey(clientIp);
  if (await getLoginLockoutUntil(env.DB, [accountLockKey, ipLockKey])) {
    return jsonResponse({ success: false, error: 'Terlalu banyak percobaan login gagal. Tunggu beberapa menit, atau hubungi administrator untuk mereset password Anda.' }, 429);
  }

  // Hardening Fase C(1): Turnstile — hanya aktif bila site key + secret
  // terpasang (env kosong = lewati, perilaku persis seperti sebelumnya).
  if (isTurnstileEnabled(env)) {
    const turnstileOk = await verifyTurnstileToken(env, typeof body.turnstileToken === 'string' ? body.turnstileToken : '', clientIp);
    if (!turnstileOk) {
      return jsonResponse({ success: false, error: 'Verifikasi keamanan gagal. Silakan coba lagi.' }, 401);
    }
  }

  // Cari user berdasarkan email atau NIP/NISN
  const row = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ? OR nip_nisn = ?'
  ).bind(identifier, identifier).first();
  if (!row) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    await consumeRateLimit(env.DB, ipRateKey, 500, 15 * 60);
    await recordLoginFailure(env.DB, accountLockKey, ACCOUNT_FAILURE_THRESHOLD);
    await recordLoginFailure(env.DB, ipLockKey, IP_FAILURE_THRESHOLD);
    await recordLoginFailureStat(env.DB);
    return jsonResponse({ success: false, error: 'Email/NIP/NISN atau password salah.' }, 401);
  }

  const ok = await verifyPassword(password, String(row.password_hash));
  if (!ok || String(row.status || 'active') !== 'active') {
    await consumeRateLimit(env.DB, ipRateKey, 500, 15 * 60);
    await recordLoginFailure(env.DB, accountLockKey, ACCOUNT_FAILURE_THRESHOLD);
    await recordLoginFailure(env.DB, ipLockKey, IP_FAILURE_THRESHOLD);
    await recordLoginFailureStat(env.DB);
    return jsonResponse({ success: false, error: 'Email/NIP/NISN atau password salah.' }, 401);
  }

  await clearRateLimit(env.DB, accountRateKey);
  await clearLoginLockout(env.DB, accountLockKey);

  // Hardening Fase B: akun staf dengan 2FA aktif tidak langsung menerima
  // sesi. Server menerbitkan tantangan singkat (hash saja yang disimpan);
  // sesi penuh baru dibuat oleh /api/auth/login/verify-2fa setelah kode
  // TOTP / kode pemulihan terbukti benar.
  const role = String(row.role);
  if (Number(row.totp_enabled || 0) === 1 && (TWO_FACTOR_ROLES as readonly string[]).includes(role)) {
    const challengeToken = `ct_${crypto.getRandomValues(new Uint8Array(32)).reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '')}`;
    await env.DB.prepare('DELETE FROM auth_challenges WHERE user_id = ?').bind(String(row.id)).run();
    await env.DB.prepare(
      'INSERT INTO auth_challenges (token_hash, user_id, attempts, expires_at) VALUES (?, ?, 0, ?)'
    ).bind(await sha256Hex(challengeToken), String(row.id), new Date(Date.now() + 10 * 60 * 1000).toISOString()).run();
    return jsonResponse({ success: true, twoFactorRequired: true, challengeToken });
  }

  const token = await createSession(env, String(row.id));

  const response = jsonResponse({
    success: true,
    user: {
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
    },
  });
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  response.headers.set('Set-Cookie', `smk_session=${token}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=604800`);
  return response;
};
