import { verifyPassword, createSession, type AuthEnv } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { clearRateLimit, consumeRateLimit } from '../../_lib/rate-limit';

interface Env extends AuthEnv {}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: { identifier?: string; password?: string };
  try {
    body = await request.json();
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
  const rateKey = `login:${clientIp}:${identifier.toLowerCase()}`;
  if (!(await consumeRateLimit(env.DB, rateKey, 10, 15 * 60))) {
    return jsonResponse({ success: false, error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' }, 429);
  }

  // Cari user berdasarkan email atau NIP/NISN
  const row = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ? OR nip_nisn = ?'
  ).bind(identifier, identifier).first();
  if (!row) {
    return jsonResponse({ success: false, error: 'Email/NIP/NISN atau password salah.' }, 401);
  }

  if (String(row.status || 'active') !== 'active') {
    return jsonResponse({ success: false, error: 'Akun ini sedang nonaktif. Hubungi administrator.' }, 403);
  }

  const ok = await verifyPassword(password, String(row.password_hash));
  if (!ok) {
    return jsonResponse({ success: false, error: 'Email/NIP/NISN atau password salah.' }, 401);
  }

  const token = await createSession(env, String(row.id));
  await clearRateLimit(env.DB, rateKey);

  const response = jsonResponse({
    success: true,
    token,
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
