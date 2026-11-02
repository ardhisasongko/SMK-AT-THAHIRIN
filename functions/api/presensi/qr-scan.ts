// Pindai kartu QR presensi (Model A): guru/piket memindai kartu siswa.
//   POST /api/presensi/qr-scan  { payload: string, tanggal?: string }
//
// Payload diverifikasi tanda tangannya di server (HMAC, QR_CARD_SECRET),
// lalu presensi dicatat lewat jalur tulis presensi yang SAMA PERSIS dengan
// input manual (applyPresensiWrite di functions/api/data/[key].ts):
// validasi per-rekaman, RBAC kelas, audit presensi_log, stempel inputBy,
// dan antrean notifikasi WhatsApp orang tua. Tidak ada jalur tulis kedua.
//
// Perilaku duplikat: satu siswa satu catatan per hari ditegakkan model data.
// Bila siswa sudah tercatat Hadir pada tanggal itu, pemindaian ditolak 409
// (tidak menulis ulang). Bila catatan hari itu berstatus lain (mis. Sakit),
// pemindaian mengoreksinya menjadi Hadir — sama seperti guru menandai Hadir
// secara manual (tercatat di audit + notifikasi koreksi).

import type { AuthUser } from '../../_lib/auth';
import { applyPresensiWrite, loadPresensiRecords } from '../data/[key]';
import {
  findActiveStudentByNisn,
  isQrCardConfigured,
  verifyQrCardPayload,
  type QrCardEnv,
} from '../../_lib/qr-card';
import { jsonResponse } from '../../_lib/response';

interface Env extends QrCardEnv {
  DB: D1Database;
  SCHOOL_NAME?: string;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

function dateWIB(now = Date.now()): string {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function timeWIB(now = Date.now()): string {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(11, 19);
}

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  const user = data.user;
  if (!user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);

  // Pemindai adalah perangkat guru/piket; siswa tidak memindai kartu.
  if (user.role === 'siswa') {
    return jsonResponse({ success: false, error: 'Pemindaian kartu QR hanya untuk guru, admin, atau ketua kelas yang bertugas.' }, 403);
  }

  if (!isQrCardConfigured(env)) {
    return jsonResponse({ success: false, error: 'Fitur kartu QR belum dikonfigurasi oleh administrator sistem.' }, 503);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body harus berupa JSON.' }, 400);
  }

  const verified = await verifyQrCardPayload(env, body?.payload);
  if (!verified) {
    return jsonResponse({ success: false, error: 'Kode QR tidak valid atau bukan kartu presensi resmi. Presensi tidak dicatat.' }, 400);
  }

  const student = await findActiveStudentByNisn(env.DB, verified.nisn);
  if (!student) {
    return jsonResponse({ success: false, error: 'Siswa pada kartu QR tidak ditemukan atau sudah tidak aktif.' }, 404);
  }

  const today = dateWIB();
  const tanggal = typeof body?.tanggal === 'string' && body.tanggal ? body.tanggal : today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    return jsonResponse({ success: false, error: 'Tanggal presensi tidak valid.' }, 400);
  }
  if (tanggal > today) {
    return jsonResponse({ success: false, error: `Tanggal ${tanggal} belum tiba. Tidak bisa menginput presensi untuk tanggal masa depan.` }, 400);
  }

  const current = await loadPresensiRecords(env.DB);
  const existing = current.find(r => r.tanggal === tanggal && r.siswaId === student.id);

  if (existing && existing.status === 'Hadir') {
    return jsonResponse({
      success: false,
      error: `${student.name} sudah tercatat Hadir pada ${tanggal} pukul ${String(existing.waktuInput || '').slice(0, 5)} WIB.`,
      data: { alreadyRecorded: true, nisn: student.nisn, name: student.name, tanggal, waktuInput: existing.waktuInput },
    }, 409);
  }

  const waktuInput = timeWIB();
  const record = existing
    ? { ...existing, status: 'Hadir', waktuInput }
    : {
        id: `p-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        tanggal,
        classId: student.classId,
        siswaId: student.id,
        siswaName: student.name,
        nisn: student.nisn,
        status: 'Hadir',
        keterangan: '',
        waktuInput,
      };

  const incoming = existing
    ? current.map(r => (r.tanggal === tanggal && r.siswaId === student.id ? record : r))
    : [record, ...current];

  const outcome = await applyPresensiWrite(env.DB, user, incoming, { schoolName: env.SCHOOL_NAME });
  if (!outcome.ok) {
    return jsonResponse({ success: false, error: outcome.error }, outcome.status);
  }
  if (!outcome.changedCount) {
    // Tidak ada perubahan tertulis (balapan data) — perlakukan sebagai duplikat.
    return jsonResponse({
      success: false,
      error: `${student.name} sudah tercatat untuk tanggal ${tanggal}.`,
      data: { alreadyRecorded: true, nisn: student.nisn, name: student.name, tanggal },
    }, 409);
  }

  return jsonResponse({
    success: true,
    data: {
      recorded: true,
      nisn: student.nisn,
      name: student.name,
      classId: student.classId,
      className: student.className,
      tanggal,
      waktuInput,
      status: 'Hadir',
      correctedFrom: existing ? String(existing.status) : undefined,
    },
  });
};
