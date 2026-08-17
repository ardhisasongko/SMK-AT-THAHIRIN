// Sinkronkan perubahan NISN dari roster siswa ke akun login (tabel users).
//   PATCH /api/users/nisn  body: { oldNisn, newNisn, name }
// Hanya admin. Menyesuaikan nip_nisn + email (`s<NISN>@smksplusatthahirin.sch.id`).
import { getUserFromRequest, type AuthEnv } from '../../_lib/auth';
import { jsonResponse, errorResponse } from '../../_lib/response';
import { readCollection, rosterReplaceStatements } from '../../_lib/student-roster';

interface Env extends AuthEnv {}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const user = await getUserFromRequest(env, request);
  if (!user) return errorResponse('Tidak terautentikasi.', 401);
  if (user.role !== 'admin' && user.role !== 'super_admin') return errorResponse('Hanya admin yang dapat mengubah NISN.', 403);

  let body: { oldNisn?: string; newNisn?: string; name?: string; student?: Record<string, unknown> };
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
  if (!/^\d{10}$/.test(newNisn)) {
    return errorResponse('NISN harus 10 digit angka.', 400);
  }

  const account = await env.DB.prepare(
    "SELECT id, email, name FROM users WHERE nip_nisn = ? AND role = 'siswa'"
  ).bind(oldNisn).first();
  if (!account) {
    return errorResponse(`Tidak ada akun siswa dengan NISN ${oldNisn}.`, 404);
  }

  const newEmail = `s${newNisn}@smksplusatthahirin.sch.id`;
  const clash = await env.DB.prepare('SELECT id FROM users WHERE id != ? AND (email = ? OR nip_nisn = ?)')
    .bind(String(account.id), newEmail, newNisn).first();
  if (clash) {
    return errorResponse('Email atau NISN baru sudah dipakai akun lain.', 409);
  }

  let roster: unknown[] | null;
  try {
    roster = await readCollection(env.DB, 'siswa_v1');
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Data roster tidak dapat diproses.', 500);
  }
  const rosterIndex = roster?.findIndex(item => item && typeof item === 'object' && String((item as any).nisn) === oldNisn) ?? -1;
  if (rosterIndex < 0) return errorResponse(`Siswa dengan NISN ${oldNisn} tidak ditemukan di roster.`, 404);
  const nextRoster = [...roster!];
  nextRoster[rosterIndex] = {
    ...(nextRoster[rosterIndex] as Record<string, unknown>),
    ...(body.student || {}),
    nisn: newNisn,
    name: name || String(account.name || ''),
  };

  try {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE users SET nip_nisn = ?, email = ?, name = ? WHERE id = ?'
      ).bind(newNisn, newEmail, name || String(account.name || ''), String(account.id)),
      ...rosterReplaceStatements(env.DB, nextRoster),
    ]);
  } catch (error) {
    console.error('Gagal menyinkronkan akun dan roster siswa:', error);
    return errorResponse('Data siswa gagal diperbarui. Tidak ada perubahan yang disimpan.', 500);
  }

  return jsonResponse({ success: true, data: { id: String(account.id), nip_nisn: newNisn, email: newEmail } });
};
