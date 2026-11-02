// Payload kartu QR presensi SATU KELAS untuk cetak massal oleh staf.
//   GET /api/presensi/qr-cards?classId=...
// Hanya pengguna yang lolos cakupan presensi kelas itu (canEditClassScoped:
// admin/super_admin semua kelas, guru sesuai penugasan, ketua_kelas approved
// untuk kelasnya sendiri) yang menerima payload kelas tersebut.

import { canEditClassScoped, type AuthUser } from '../../_lib/auth';
import { buildQrCardPayload, isQrCardConfigured, type QrCardEnv } from '../../_lib/qr-card';
import { jsonResponse } from '../../_lib/response';

interface Env extends QrCardEnv {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  const user = data.user;
  if (!user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);

  const classId = new URL(request.url).searchParams.get('classId')?.trim() || '';
  if (!classId) {
    return jsonResponse({ success: false, error: 'Parameter classId wajib diisi.' }, 400);
  }

  if (!(await canEditClassScoped(env.DB, user, classId))) {
    return jsonResponse({ success: false, error: 'Kelas berada di luar cakupan kewenangan Anda.' }, 403);
  }

  const classRow = await env.DB.prepare('SELECT name FROM school_classes WHERE id = ?')
    .bind(classId)
    .first<{ name: string }>();
  const className = classRow?.name ? String(classRow.name) : classId;

  if (!isQrCardConfigured(env)) {
    return jsonResponse({ success: true, data: { configured: false, classId, className, cards: [] } });
  }

  const { results } = await env.DB.prepare(
    'SELECT nisn, name FROM students WHERE class_id = ? AND active = 1 ORDER BY position, name'
  ).bind(classId).all<{ nisn: string; name: string }>();

  const cards = await Promise.all((results || []).map(async row => ({
    nisn: String(row.nisn),
    name: String(row.name),
    payload: await buildQrCardPayload(env, String(row.nisn)),
  })));

  return jsonResponse({ success: true, data: { configured: true, classId, className, cards } });
};
