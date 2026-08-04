// Generic JSON collection storage backed by Cloudflare D1.
// Semua akses kini butuh login (middleware menyediakan context.data.user).
// PUT presensi_v1 diverifikasi per-rekaman: cek hak akses kelas + rekam inputBy (audit).
//
// Routes:
//   GET /api/data                 -> list all collection keys
//   GET /api/data/:key            -> get a collection JSON value
//   PUT /api/data/:key            -> upsert a collection (body = full JSON array/object)
//   DELETE /api/data/:key         -> delete a collection (admin only)

import { canEditClass, jsonResponse, type AuthUser } from '../../_lib/auth';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

const isPresensiKey = (k: string) => k === 'presensi_v1';

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

/**
 * Untuk key presensi, bandingkan array lama vs baru. Rekaman yang BERUBAH
 * wajib boleh diedit user; bila ada perubahan pada kelas di luar haknya -> 403.
 * Rekaman yang berubah di-stamp inputBy (audit trail).
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

    // Deteksi perubahan (status / keterangan / waktuInput / completeness)
    const isChanged = !prev
      || prev.status !== record.status
      || (prev.keterangan || '') !== (record.keterangan || '')
      || (prev.waktuInput || '') !== (record.waktuInput || '');

    if (isChanged) {
      // Otorisasi per kelas
      if (user.role === 'guru') {
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
      record.inputBy = { id: user.id, name: user.name, role: user.role };
      changedCount++;
    }

    result.push(record);
  }

  return { ok: true, status: 200, result, changedCount };
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, params, data }) => {
  if (!data.user) {
    return jsonResponse({ success: false, error: 'Silakan login terlebih dahulu.' }, 401);
  }
  const { key } = params as { key?: string };
  const db = env.DB;

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