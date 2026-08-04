// Sinkronkan perubahan NISN dari roster siswa ke akun login (tabel users).
//   PATCH /api/users/nisn  body: { oldNisn, newNisn, name }
// Hanya admin. Menyesuaikan nip_nisn + email (`s<NISN>@smksplusatthahirin.sch.id`).
import { getUserFromRequest, type AuthEnv } from '../../_lib/auth';
import { jsonResponse, errorResponse } from '../../_lib/response';

interface Env extends AuthEnv {}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const user = await getUserFromRequest(env, request);
  if (!user) return errorResponse('Tidak terautentikasi.', 401);
  if (user.role !== 'admin') return errorResponse('Hanya admin yang dapat mengubah NISN.', 403);

  let body: { oldNisn?: string; newNisn?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Body harus berupa JSON.', 400);
  }
  const oldNisn = (body.oldNisn || '').trim();
  const newNisn = (body.newNisn || '').trim();
  const name = (body.name || '').trim();

  if (!oldNisn || !newNisn) {
    return errorResponse('oldNisn dan newNisn wajib diisi.', 400);
  }
  if (!/^\d{8,10}$/.test(newNisn)) {
    return errorResponse('NISN harus 8-10 digit angka.', 400);
  }

  const account = await env.DB.prepare(
    "SELECT id, email, name FROM users WHERE nip_nisn = ? AND role = 'siswa'"
  ).bind(oldNisn).first();
  if (!account) {
    return errorResponse(`Tidak ada akun siswa dengan NISN ${oldNisn}.`, 404);
  }

  const newEmail = `s${newNisn}@smksplusatthahirin.sch.id`;
  if (String(account.email) !== newEmail) {
    const clash = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(newEmail).first();
    if (clash) {
      return errorResponse(`Email ${newEmail} sudah dipakai akun lain.`, 409);
    }
  }

  await env.DB.prepare(
    'UPDATE users SET nip_nisn = ?, email = ?, name = ? WHERE id = ?'
  ).bind(newNisn, newEmail, name || String(account.name || ''), String(account.id)).run();

  return jsonResponse({ success: true, data: { id: String(account.id), nip_nisn: newNisn, email: newEmail } });
};
