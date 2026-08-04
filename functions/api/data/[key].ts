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

import { canEditClass, jsonResponse, type AuthUser } from '../../_lib/auth';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

const isPresensiKey = (k: string) => k === 'presensi_v1';

/** WIB = UTC+7. Cek apakah waktu sekarang sebelum jam 08:00 WIB. */
export function isBeforeCutoffWIB(): boolean {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return now.getUTCHours() < 8;
}

async function getCurrent(db: D1Database, key: string): Promise<unknown> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first();
  if (!row) return null;
  try {
    return JSON.parse(String(row.value));
  } catch {
    return null;
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

/** Validasi hak akses guru: record.classId harus kelas yang diampunya (waliKelas = nama user). */
async function teacherCanEditClass(db: D1Database, teacherName: string, classId: string): Promise<boolean> {
  const kelasArr = (await getCurrent(db, 'kelas_v1')) as Array<{ id?: string; waliKelas?: string }> | null;
  if (!Array.isArray(kelasArr)) return false;
  const kelas = kelasArr.find(k => k.id === classId);
  return !!(kelas && kelas.waliKelas && kelas.waliKelas.trim() === teacherName.trim());
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
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
): Promise<{ ok: boolean; status: number; error?: string; result?: unknown; changedCount?: number }> {
  if (!Array.isArray(incoming)) {
    return { ok: false, status: 400, error: 'presensi_v1 harus berupa array.' };
  }

  const currentArr = (await getCurrent(db, 'presensi_v1')) as Array<any> | null;
  const currentMap = new Map<string, any>();
  (currentArr || []).forEach(r => {
    currentMap.set(`${r.tanggal}|${r.siswaId}`, r);
  });

  const result: any[] = [];
  let changedCount = 0;

  for (const record of incoming) {
    const key = `${record.tanggal}|${record.siswaId}`;
    const prev = currentMap.get(key);

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
      } else if (user.role === 'guru') {
        // Validasi guru: wali kelas
        const can = await teacherCanEditClass(db, user.name, record.classId);
        if (!can) {
          return { ok: false, status: 403, error: `Guru tidak berwenang mengubah presensi kelas ${record.classId}.` };
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
            await writePresensiLog(db, record.tanggal, record.siswaId, record.siswaName, field, String(oldVal), String(newVal), user);
          }
        }
        // Log perubahan lokasi
        const oldLoc = JSON.stringify(prev.lokasi || null);
        const newLoc = JSON.stringify(record.lokasi || null);
        if (oldLoc !== newLoc) {
          await writePresensiLog(db, record.tanggal, record.siswaId, record.siswaName, 'lokasi', oldLoc, newLoc, user);
        }
      } else {
        // Record baru (belum ada sebelumnya)
        await writePresensiLog(db, record.tanggal, record.siswaId, record.siswaName, 'status', '(baru)', record.status, user);
      }

      record.inputBy = { id: user.id, name: user.name, role: user.role };
      changedCount++;
    }

    result.push(record);
  }

  return { ok: true, status: 200, result, changedCount };
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, params, request, data }) => {
  if (!data.user) {
    return jsonResponse({ success: false, error: 'Silakan login terlebih dahulu.' }, 401);
  }
  const { key } = params as { key?: string };
  const db = env.DB;

  // Audit trail: GET /api/data/presensi_log (admin only)
  if (key === 'presensi_log') {
    if (data.user.role !== 'admin') {
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
    const { results } = await db
      .prepare("SELECT key, updated_at FROM app_data ORDER BY key")
      .all();
    return jsonResponse({ success: true, data: results });
  }

  const k = String(key);
  const value = await getCurrent(db, k);
  return jsonResponse({ success: true, data: value });
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body harus berupa JSON.' }, 400);
  }

  if (isPresensiKey(k)) {
    const checked = await validateAndPatchPresensi(env.DB, data.user, body);
    if (!checked.ok) {
      return jsonResponse({ success: false, error: checked.error }, checked.status);
    }
    await save(env.DB, k, checked.result);
    return jsonResponse({ success: true, data: checked.result, changed: checked.changedCount });
  }

  // Koleksi lain: tulis asal sudah login (perluasan kebijakan per-key dapat disusun kemudian).
  await save(env.DB, k, body);
  return jsonResponse({ success: true, data: body });
};

export const onRequestDelete: PagesFunction<Env, any, AuthData> = async ({ env, params, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login terlebih dahulu.' }, 401);
  if (data.user.role !== 'admin') {
    return jsonResponse({ success: false, error: 'Hanya admin yang dapat menghapus koleksi.' }, 403);
  }
  const { key } = params as { key?: string };
  if (!key) return jsonResponse({ success: false, error: 'Key tidak ditemukan.' }, 400);
  await env.DB.prepare("DELETE FROM app_data WHERE key = ?").bind(String(key)).run();
  return jsonResponse({ success: true });
};