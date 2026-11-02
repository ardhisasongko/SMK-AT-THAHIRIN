// Payload kartu QR presensi untuk SATU siswa.
//   GET /api/presensi/qr-card            -> kartu milik sendiri (siswa/ketua_kelas);
//                                           untuk staf tanpa ?nisn: hanya status konfigurasi.
//   GET /api/presensi/qr-card?nisn=...   -> kartu siswa tertentu.
// Siswa/ketua_kelas HANYA boleh mengambil payload dirinya sendiri. Staf
// (guru/admin/super_admin) mengikuti cakupan presensi yang sudah berlaku
// (canEditClassScoped). Payload ditandatangani server (functions/_lib/qr-card)
// dan hanya terbit bila QR_CARD_SECRET terpasang; selain itu respons berisi
// configured: false agar UI menampilkan pesan sopan (pola status 2FA).

import { canEditClassScoped, type AuthUser } from '../../_lib/auth';
import {
  buildQrCardPayload,
  findActiveStudentByNisn,
  isQrCardConfigured,
  type QrCardEnv,
} from '../../_lib/qr-card';
import { jsonResponse } from '../../_lib/response';

interface Env extends QrCardEnv {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

const STAFF_ROLES = ['guru', 'admin', 'super_admin'];

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  const user = data.user;
  if (!user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);

  const configured = isQrCardConfigured(env);
  const requestedNisn = new URL(request.url).searchParams.get('nisn')?.trim() || '';

  // Staf tanpa target: hanya kembalikan status konfigurasi (dipakai tab
  // pemindai untuk menampilkan pemberitahuan sebelum kamera dijalankan).
  if (!requestedNisn && STAFF_ROLES.includes(user.role)) {
    return jsonResponse({ success: true, data: { configured } });
  }

  const isStudentRole = user.role === 'siswa' || user.role === 'ketua_kelas';
  let targetNisn = requestedNisn;
  if (isStudentRole) {
    if (!user.nipNisn) {
      return jsonResponse({ success: false, error: 'Akun Anda tidak memiliki NISN.' }, 403);
    }
    if (targetNisn && targetNisn !== user.nipNisn) {
      return jsonResponse({ success: false, error: 'Anda hanya dapat melihat kartu QR milik sendiri.' }, 403);
    }
    targetNisn = user.nipNisn;
  }
  if (!targetNisn) {
    return jsonResponse({ success: false, error: 'Parameter nisn wajib diisi.' }, 400);
  }

  const student = await findActiveStudentByNisn(env.DB, targetNisn);
  if (!student) {
    return jsonResponse({ success: false, error: 'Siswa tidak ditemukan atau sudah tidak aktif.' }, 404);
  }

  if (!isStudentRole && !(await canEditClassScoped(env.DB, user, student.classId))) {
    return jsonResponse({ success: false, error: 'Siswa berada di luar cakupan kelas kewenangan Anda.' }, 403);
  }

  if (!configured) {
    return jsonResponse({
      success: true,
      data: {
        configured: false,
        nisn: student.nisn,
        name: student.name,
        classId: student.classId,
        className: student.className,
      },
    });
  }

  return jsonResponse({
    success: true,
    data: {
      configured: true,
      payload: await buildQrCardPayload(env, student.nisn),
      nisn: student.nisn,
      name: student.name,
      classId: student.classId,
      className: student.className,
    },
  });
};
