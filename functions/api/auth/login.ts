import { verifyPassword, createSession, type AuthEnv } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';

interface Env extends AuthEnv {}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: { identifier?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body harus berupa JSON.' }, 400);
  }

  const identifier = (body.identifier || '').trim();
  const password = body.password || '';
  if (!identifier || !password) {
    return jsonResponse({ success: false, error: 'Identifier dan password wajib diisi.' }, 400);
  }

  // Cari user berdasarkan email atau NIP/NISN
  const row = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ? OR nip_nisn = ?'
  ).bind(identifier, identifier).first();
  if (!row) {
    return jsonResponse({ success: false, error: 'Email/NIP/NISN atau password salah.' }, 401);
  }

  const ok = await verifyPassword(password, String(row.password_hash));
  if (!ok) {
    return jsonResponse({ success: false, error: 'Email/NIP/NISN atau password salah.' }, 401);
  }

  const token = await createSession(env, String(row.id));

  return jsonResponse({
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
    },
  });
};
