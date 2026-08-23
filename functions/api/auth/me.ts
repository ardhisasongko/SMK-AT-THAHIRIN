import { getUserFromRequest, getAssignedClassIds, type AuthEnv } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';

interface Env extends AuthEnv {}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const user = await getUserFromRequest(env, request);
  if (!user) {
    return jsonResponse({ success: false, error: 'Tidak terautentikasi.' }, 401);
  }
  // Penugasan kelas untuk guru (migrasi 0026) — dipakai client membatasi
  // dropdown absensi. Kosong = belum dikonfigurasi = semua kelas (perilaku lama).
  const classAssignments = user.role === 'guru' ? await getAssignedClassIds(env.DB, user.id) : [];
  return jsonResponse({ success: true, user: { ...user, classAssignments } });
};