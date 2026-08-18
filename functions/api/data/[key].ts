// Generic JSON collection storage backed by Cloudflare D1.
// Semua akses kini butuh login (middleware menyediakan context.data.user).
// PUT presensi_v1 diverifikasi per-rekaman: cek hak akses kelas + rekam inputBy (audit).
// Siswa bisa input/edit sendiri sebelum jam 08:00 WIB.
// Admin/guru/ketua bisa override kapan saja.
//
// Routes:
//   GET /api/data                 -> list all collection keys
//   GET /api/data/:key            -> get a collection JSON value
//   GET /api/data/presensi_log    -> audit trail (admin only)
//   PUT /api/data/:key            -> upsert a collection (body = full JSON array/object)
//   DELETE /api/data/:key         -> delete a collection (admin only)

import { canEditClass, type AuthUser } from '../../_lib/auth';
import {
  CollectionDataError,
  RELATIONAL_COLLECTIONS,
  readRelationalCollection,
  validateCollection,
  writeRelationalCollection,
} from '../../_lib/relational-data';
import { jsonResponse } from '../../_lib/response';
import { attendanceMessage, enqueueMessage } from '../../_lib/whatsapp';

interface Env {
  DB: D1Database;
  SCHOOL_NAME?: string;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

const isPresensiKey = (k: string) => k === 'presensi_v1';
const KNOWN_COLLECTIONS = new Set([
  'kelas_v1', 'siswa_v1', 'presensi_v1', 'modulAjar_v1', 'forumTopics_v1',
  'notifications_v1', 'cbtExams_v1', 'cbtSubmissions_v1',
]);
const PRESENSI_STATUSES = new Set(['Hadir', 'Terlambat', 'Sakit', 'Izin', 'Alpa']);

function dateWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function validatePresensiRecord(record: any): string | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'Format rekaman presensi tidak valid.';
  if (typeof record.id !== 'string' || record.id.length < 1 || record.id.length > 100) return 'ID presensi tidak valid.';
  if (typeof record.tanggal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.tanggal)) return 'Tanggal presensi tidak valid.';
  if (typeof record.siswaId !== 'string' || !record.siswaId || record.siswaId.length > 100) return 'ID siswa tidak valid.';
  if (typeof record.nisn !== 'string' || !record.nisn || record.nisn.length > 30) return 'NISN tidak valid.';
  if (typeof record.classId !== 'string' || !record.classId || record.classId.length > 100) return 'Kelas tidak valid.';
  if (!PRESENSI_STATUSES.has(record.status)) return 'Status presensi tidak valid.';
  if (record.keterangan != null && (typeof record.keterangan !== 'string' || record.keterangan.length > 500)) return 'Keterangan maksimal 500 karakter.';
  if (typeof record.waktuInput !== 'string' || !/^\d{2}:\d{2}:\d{2}$/.test(record.waktuInput)) return 'Waktu presensi tidak valid.';
  if (record.fotoUrl != null && (typeof record.fotoUrl !== 'string' || !/^\/api\/photo\/[0-9a-f-]{36}$/.test(record.fotoUrl))) return 'Referensi foto tidak valid.';
  if (record.lokasi != null) {
    const { lat, lng } = record.lokasi;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return 'Koordinat lokasi tidak valid.';
  }
  return null;
}

function canWriteCollection(user: AuthUser, key: string): boolean {
  if (['cbtExams_v1', 'cbtSubmissions_v1', 'forumTopics_v1', 'notifications_v1'].includes(key)) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (key === 'presensi_v1') return true;
  if (user.role === 'guru') {
    return ['cbtExams_v1', 'cbtSubmissions_v1', 'modulAjar_v1', 'forumTopics_v1', 'notifications_v1'].includes(key);
  }
  if (user.role === 'siswa' || user.role === 'ketua_kelas') {
    return ['cbtSubmissions_v1', 'forumTopics_v1', 'notifications_v1'].includes(key);
  }
  return false;
}

/** WIB = UTC+7. Cek apakah waktu sekarang sebelum jam 08:00 WIB. */
export function isBeforeCutoffWIB(): boolean {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return now.getUTCHours() < 8;
}

async function getCurrent(db: D1Database, key: string): Promise<unknown> {
  if (RELATIONAL_COLLECTIONS.has(key)) {
    return (await readRelationalCollection(db, key as any)).data;
  }
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first();
  if (!row) return null;
  try {
    return JSON.parse(String(row.value));
  } catch {
    throw new CollectionDataError(`Data ${key} rusak dan tidak dapat diproses.`);
  }
}

async function save(db: D1Database, key: string, value: unknown): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO app_data (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, JSON.stringify(value), now)
    .run();
}

function filterCollectionForUser(value: unknown, key: string, user: AuthUser): unknown {
  if (!Array.isArray(value) || (user.role !== 'siswa' && user.role !== 'ketua_kelas')) return value;
  if (key === 'siswa_v1' || key === 'presensi_v1') {
    if (user.role === 'ketua_kelas') return value.filter((item: any) => item.classId === user.classId);
    return value.filter((item: any) => item.nisn === user.nipNisn);
  }
  if (key === 'cbtSubmissions_v1') {
    return value.filter((item: any) => item.studentId === user.id || item.siswaId === user.id);
  }
  return value;
}

function requestedRevision(request: Request): { revision?: number; error?: string } {
  const raw = request.headers.get('If-Match') ?? request.headers.get('X-Collection-Revision');
  if (raw == null || raw.trim() === '') return {};
  const normalized = raw.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  if (!/^\d+$/.test(normalized)) return { error: 'Revision koleksi tidak valid.' };
  return { revision: Number(normalized) };
}

/** Siswa hanya boleh edit record sendiri (cek NISN) sebelum jam 08:00 WIB. */
export function studentCanEdit(user: AuthUser, record: any): { ok: boolean; error?: string } {
  if (user.role !== 'siswa') return { ok: true };

  // Siswa hanya bisa edit record sendiri (cek NISN)
  if (!user.nipNisn || user.nipNisn !== record.nisn) {
    return { ok: false, error: 'Siswa hanya bisa menginput/mengedit kehadiran sendiri.' };
  }

  // Siswa hanya bisa edit sebelum jam 08:00 WIB
  if (!isBeforeCutoffWIB()) {
    return { ok: false, error: 'Batas waktu input/edit adalah jam 08:00 WIB. Silakan hubungi guru/admin.' };
  }

  return { ok: true };
}

/** Tulis log perubahan presensi ke tabel presensi_log. */
async function writePresensiLog(
  db: D1Database,
  tanggal: string,
  siswaId: string,
  siswaName: string,
  field: string,
  oldValue: string,
  newValue: string,
  changedBy: AuthUser
): Promise<void> {
  const id = `log-${crypto.randomUUID()}`;
  const nowWib = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  await db
    .prepare(
      `INSERT INTO presensi_log (id, tanggal, siswa_id, siswa_name, field_changed, old_value, new_value, changed_by_name, changed_by_role, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, tanggal, siswaId, siswaName, field, oldValue, newValue, changedBy.name, changedBy.role, nowWib)
    .run();
}

/**
 * Untuk key presensi, bandingkan array lama vs baru. Rekaman yang BERUBAH
 * wajib boleh diedit user; bila ada perubahan pada kelas di luar haknya -> 403.
 * Rekaman yang berubah di-stamp inputBy (audit trail).
 * Siswa: validasi own record + jam 08:00 WIB.
 */
async function validateAndPatchPresensi(
  db: D1Database,
  user: AuthUser,
  incoming: unknown
): Promise<{ ok: boolean; status: number; error?: string; result?: unknown; changedCount?: number; logs?: Array<{ tanggal: string; siswaId: string; siswaName: string; field: string; oldValue: string; newValue: string }> }> {
  if (!Array.isArray(incoming)) {
    return { ok: false, status: 400, error: 'presensi_v1 harus berupa array.' };
  }
  if (incoming.length > 10_000) {
    return { ok: false, status: 413, error: 'Jumlah rekaman presensi terlalu besar.' };
  }

  const currentArr = (await getCurrent(db, 'presensi_v1')) as Array<any> | null;
  const roster = (await getCurrent(db, 'siswa_v1')) as Array<any> | null;
  const submitted = user.role === 'siswa'
    ? incoming.filter(record => record?.nisn === user.nipNisn)
    : incoming;
  const currentMap = new Map<string, any>();
  (currentArr || []).forEach(r => {
    currentMap.set(`${r.tanggal}|${r.siswaId}`, r);
  });

  const result: any[] = [];
  const logs: Array<{ tanggal: string; siswaId: string; siswaName: string; field: string; oldValue: string; newValue: string }> = [];
  let changedCount = 0;

  for (const rawRecord of submitted) {
    const record = { ...rawRecord };
    const rosterStudent = (roster || []).find(student =>
      user.role === 'siswa'
        ? student.nisn === user.nipNisn
        : student.id === record.siswaId && student.nisn === record.nisn
    );
    if (!rosterStudent) {
      return { ok: false, status: 400, error: 'Identitas siswa tidak ditemukan atau tidak cocok dengan data sekolah.' };
    }
    record.siswaId = rosterStudent.id;
    record.siswaName = rosterStudent.name;
    record.nisn = rosterStudent.nisn;
    record.classId = rosterStudent.classId;

    const validationError = validatePresensiRecord(record);
    if (validationError) return { ok: false, status: 400, error: validationError };
    if (user.role === 'siswa' && record.tanggal !== dateWIB()) {
      return { ok: false, status: 403, error: 'Siswa hanya dapat mengisi presensi untuk hari ini.' };
    }

    const key = `${record.tanggal}|${record.siswaId}`;
    const prev = currentMap.get(key);
    if (prev) record.id = prev.id;

    // Deteksi perubahan (status / keterangan / waktuInput / foto / lokasi / completeness)
    const isChanged = !prev
      || prev.status !== record.status
      || (prev.keterangan || '') !== (record.keterangan || '')
      || (prev.waktuInput || '') !== (record.waktuInput || '')
      || (prev.fotoUrl || '') !== (record.fotoUrl || '')
      || JSON.stringify(prev.lokasi || null) !== JSON.stringify(record.lokasi || null);

    if (isChanged) {
      // Validasi siswa: own record + jam 08:00
      if (user.role === 'siswa') {
        const check = studentCanEdit(user, record);
        if (!check.ok) {
          return { ok: false, status: 403, error: check.error };
        }
      } else if (!canEditClass(user, record.classId)) {
        return {
          ok: false,
          status: 403,
          error: `Rekaman untuk kelas ${record.classId} di luar kewenangan Anda.`,
        };
      }

      // Log perubahan (bandingkan field by field)
      if (prev) {
        const fieldsToCheck: Array<[string, string]> = [
          ['status', prev.status],
          ['keterangan', prev.keterangan || ''],
          ['fotoUrl', prev.fotoUrl || ''],
        ];
        for (const [field, oldVal] of fieldsToCheck) {
          const newVal = record[field] || '';
          if (String(oldVal) !== String(newVal)) {
            logs.push({ tanggal: record.tanggal, siswaId: record.siswaId, siswaName: record.siswaName, field, oldValue: String(oldVal), newValue: String(newVal) });
          }
        }
        // Log perubahan lokasi
        const oldLoc = JSON.stringify(prev.lokasi || null);
        const newLoc = JSON.stringify(record.lokasi || null);
        if (oldLoc !== newLoc) {
          logs.push({ tanggal: record.tanggal, siswaId: record.siswaId, siswaName: record.siswaName, field: 'lokasi', oldValue: oldLoc, newValue: newLoc });
        }
      } else {
        // Record baru (belum ada sebelumnya)
        logs.push({ tanggal: record.tanggal, siswaId: record.siswaId, siswaName: record.siswaName, field: 'status', oldValue: '(baru)', newValue: record.status });
      }

      record.inputBy = { id: user.id, name: user.name, role: user.role };
      changedCount++;
    } else {
      record.inputBy = prev.inputBy;
    }

    result.push(record);
  }

  // Cegah kehilangan data (last-write-wins tanpa deteksi konflik): rekaman yang
  // SUDAH ada di server tapi tidak dikirim client (mis. tab/device lain membawa
  // data usang) tetap dipertahankan — client hanya menambah/mengubah, tidak
  // menghapus (tidak ada fitur hapus presensi).
  const incomingKeys = new Set(result.map(r => `${r.tanggal}|${r.siswaId}`));
  for (const cur of currentArr || []) {
    if (!incomingKeys.has(`${cur.tanggal}|${cur.siswaId}`)) {
      result.push(cur);
    }
  }

  return { ok: true, status: 200, result, changedCount, logs };
}

async function enqueueAttendanceNotifications(db: D1Database, incoming: any[], previous: any[], schoolName = 'SMK PLUS AT THAHIRIN'): Promise<void> {
  const setting: any = await db.prepare('SELECT enabled, absence_cutoff FROM whatsapp_settings WHERE id=1').first();
  if (!setting || Number(setting.enabled) !== 1) return;
  const classesRow = await db.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first();
  const classes = classesRow ? JSON.parse(String(classesRow.value)) as any[] : [];
  for (const record of incoming) {
    const old = previous.find(r => r.tanggal === record.tanggal && r.siswaId === record.siswaId);
    if (old && old.status === record.status) continue;
    const contact: any = await db.prepare('SELECT * FROM guardian_contacts WHERE student_id=?').bind(record.siswaId).first();
    if (!contact) continue;
    const className = classes.find(k => k.id === record.classId)?.name || record.classId;
    const note = old ? `Koreksi status sebelumnya: ${old.status}. ${record.keterangan || ''}`.trim() : record.keterangan;
    const text = attendanceMessage({ studentName: record.siswaName, className, status: record.status, date: record.tanggal, time: String(record.waktuInput || '').slice(0,5), note }, schoolName);
    const scheduledAt = record.status === 'Alpa' ? new Date(`${record.tanggal}T${String(setting.absence_cutoff || '09:00')}:00+07:00`).toISOString() : new Date().toISOString();
    for (const dest of [{slot:1,phone:contact.guardian_1_phone,enabled:contact.guardian_1_enabled},{slot:2,phone:contact.guardian_2_phone,enabled:contact.guardian_2_enabled}]) {
      if (Number(dest.enabled) === 1 && dest.phone) await enqueueMessage(db,{dedupeKey:`attendance:${record.tanggal}:${record.siswaId}:${record.status}:g${dest.slot}`,phone:String(dest.phone),type:'attendance',text,studentId:record.siswaId,attendanceDate:record.tanggal,scheduledAt});
    }
  }
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, params, request, data }) => {
  if (!data.user) {
    return jsonResponse({ success: false, error: 'Silakan login terlebih dahulu.' }, 401);
  }
  const { key } = params as { key?: string };
  const db = env.DB;

  // Audit trail: GET /api/data/presensi_log (admin only)
  if (key === 'presensi_log') {
    if (data.user.role !== 'admin' && data.user.role !== 'super_admin') {
      return jsonResponse({ success: false, error: 'Hanya admin yang dapat melihat log perubahan.' }, 403);
    }
    const url = new URL(request.url);
    const tanggal = url.searchParams.get('tanggal');
    const siswaId = url.searchParams.get('siswa_id');
    let query = 'SELECT * FROM presensi_log';
    const conditions: string[] = [];
    const binds: string[] = [];
    if (tanggal) { conditions.push('tanggal = ?'); binds.push(tanggal); }
    if (siswaId) { conditions.push('siswa_id = ?'); binds.push(siswaId); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY changed_at DESC LIMIT 500';
    const stmt = binds.length ? db.prepare(query).bind(...binds) : db.prepare(query);
    const { results } = await stmt.all();
    return jsonResponse({ success: true, data: results });
  }

  if (!key) {
    if (data.user.role !== 'admin' && data.user.role !== 'super_admin') {
      return jsonResponse({ success: false, error: 'Hanya admin yang dapat melihat daftar koleksi.' }, 403);
    }
    const { results } = await db
      .prepare("SELECT key, updated_at FROM app_data ORDER BY key")
      .all();
    return jsonResponse({ success: true, data: results });
  }

  const k = String(key);
  if (!KNOWN_COLLECTIONS.has(k)) {
    return jsonResponse({ success: false, error: 'Koleksi tidak dikenal.' }, 404);
  }
  if (['cbtExams_v1', 'cbtSubmissions_v1', 'forumTopics_v1', 'notifications_v1'].includes(k)) {
    return jsonResponse({ success: false, error: 'Koleksi telah dipindahkan ke API domain.' }, 410);
  }
  try {
    if (RELATIONAL_COLLECTIONS.has(k)) {
      const result = await readRelationalCollection(db, k as any);
      return jsonResponse({ success: true, data: filterCollectionForUser(result.data, k, data.user), revision: result.revision });
    }
    const value = await getCurrent(db, k);
    return jsonResponse({ success: true, data: filterCollectionForUser(value, k, data.user) });
  } catch (error) {
    console.error(`Gagal membaca koleksi ${k}:`, error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Data koleksi tidak dapat diproses.' }, 500);
  }
};

export const onRequestPut: PagesFunction<Env, any, AuthData> = async ({ env, params, request, data }) => {
  if (!data.user) {
    return jsonResponse({ success: false, error: 'Silakan login terlebih dahulu.' }, 401);
  }
  const { key } = params as { key?: string };
  if (!key) {
    return jsonResponse({ success: false, error: 'Key tidak ditemukan.' }, 400);
  }
  const k = String(key);

  if (!KNOWN_COLLECTIONS.has(k)) {
    return jsonResponse({ success: false, error: 'Koleksi tidak dikenal.' }, 404);
  }

  if (!canWriteCollection(data.user, k)) {
    return jsonResponse({ success: false, error: 'Role Anda tidak berwenang mengubah data ini.' }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body harus berupa JSON.' }, 400);
  }

  const requested = requestedRevision(request);
  if (requested.error) return jsonResponse({ success: false, error: requested.error }, 400);

  if (RELATIONAL_COLLECTIONS.has(k)) {
    try {
      validateCollection(k, body);
    } catch (error) {
      return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Data koleksi tidak valid.' }, 400);
    }
  }

  if (isPresensiKey(k)) {
    let previous: any[];
    let checked: Awaited<ReturnType<typeof validateAndPatchPresensi>>;
    try {
      previous = (await getCurrent(env.DB, k)) as any[] || [];
      checked = await validateAndPatchPresensi(env.DB, data.user, body);
    } catch (error) {
      return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Data presensi tidak dapat diproses.' }, 500);
    }
    if (!checked.ok) {
      return jsonResponse({ success: false, error: checked.error }, checked.status);
    }
    let write;
    try {
      write = await writeRelationalCollection(env.DB, k, checked.result, requested.revision);
    } catch (error) {
      if (error instanceof CollectionDataError) return jsonResponse({ success: false, error: error.message }, 400);
      throw error;
    }
    if (write.conflict) {
      return jsonResponse({ success: false, error: 'Data telah berubah di perangkat lain. Muat ulang sebelum menyimpan.', revision: write.revision }, 409);
    }
    try {
      for (const log of checked.logs || []) {
        await writePresensiLog(env.DB, log.tanggal, log.siswaId, log.siswaName, log.field, log.oldValue, log.newValue, data.user);
      }
    } catch (error) {
      console.error('Presensi tersimpan, tetapi audit log gagal:', error);
    }
    try {
      await enqueueAttendanceNotifications(env.DB, Array.isArray(checked.result) ? checked.result : [], previous, env.SCHOOL_NAME);
    } catch (error) {
      console.error('Presensi tersimpan, tetapi antrean notifikasi gagal:', error);
    }
    return jsonResponse({
      success: true,
      data: filterCollectionForUser(checked.result, k, data.user),
      changed: checked.changedCount,
      revision: write.revision,
    });
  }

  if (k === 'siswa_v1') {
    const existing = await env.DB.prepare("SELECT 1 AS present FROM app_data WHERE key='siswa_v1'").first();
    if (existing) {
      return jsonResponse({ success: false, error: 'Roster siswa dikelola melalui Manajemen Pengguna agar perubahan akun tetap sinkron.' }, 409);
    }
    const write = await writeRelationalCollection(env.DB, k, body, requested.revision);
    if (write.conflict) return jsonResponse({ success: false, error: 'Data telah berubah di perangkat lain.', revision: write.revision }, 409);
    return jsonResponse({ success: true, data: body, revision: write.revision });
  }

  if (RELATIONAL_COLLECTIONS.has(k)) {
    const write = await writeRelationalCollection(env.DB, k as any, body, requested.revision);
    if (write.conflict) {
      return jsonResponse({ success: false, error: 'Data telah berubah di perangkat lain. Muat ulang sebelum menyimpan.', revision: write.revision }, 409);
    }
    return jsonResponse({ success: true, data: body, revision: write.revision });
  }
  await save(env.DB, k, body);
  return jsonResponse({ success: true, data: body });
};

export const onRequestDelete: PagesFunction<Env, any, AuthData> = async ({ env, params, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login terlebih dahulu.' }, 401);
  if (data.user.role !== 'admin' && data.user.role !== 'super_admin') {
    return jsonResponse({ success: false, error: 'Hanya admin yang dapat menghapus koleksi.' }, 403);
  }
  const { key } = params as { key?: string };
  if (!key) return jsonResponse({ success: false, error: 'Key tidak ditemukan.' }, 400);
  if (!KNOWN_COLLECTIONS.has(String(key))) return jsonResponse({ success: false, error: 'Koleksi tidak dikenal.' }, 404);
  if (['cbtExams_v1', 'cbtSubmissions_v1', 'forumTopics_v1', 'notifications_v1'].includes(String(key))) {
    return jsonResponse({ success: false, error: 'Koleksi domain tidak dapat dihapus melalui API generik.' }, 410);
  }
  if (RELATIONAL_COLLECTIONS.has(String(key))) {
    return jsonResponse({ success: false, error: 'Koleksi akademik tidak dapat dihapus; simpan array kosong bila diperlukan.' }, 409);
  }
  await env.DB.prepare("DELETE FROM app_data WHERE key = ?").bind(String(key)).run();
  return jsonResponse({ success: true });
};
