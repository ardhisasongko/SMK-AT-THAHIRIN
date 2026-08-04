// Kelola role ketua_kelas oleh ADMIN.
//   GET    /api/users/ketua      -> daftar ketua kelas beserta kelasnya
//   POST   /api/users/ketua      -> tetapkan siswa sebagai ketua kelas (body: { siswaId, classId })
//   DELETE /api/users/ketua      -> cabut status ketua (body: { userId })

import { hashPassword, type AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

async function getCurrent(db: D1Database, key: string): Promise<unknown> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first();
  if (!row) return null;
  try {
    return JSON.parse(String(row.value));
  } catch {
    return null;
  }
}

interface SiswaRow {
  id: string;
  nisn: string;
  name: string;
  classId: string;
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user || data.user.role !== 'admin') {
    return jsonResponse({ success: false, error: 'Akses khusus admin.' }, 403);
  }
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, nip_nisn, class_id, ketua_status, approved_by, approved_at
     FROM users WHERE role = 'ketua_kelas'`
  ).all();
  return jsonResponse({
    success: true,
    data: results.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      nipNisn: r.nip_nisn != null ? String(r.nip_nisn) : null,
      classId: r.class_id != null ? String(r.class_id) : null,
      ketuaStatus: String(r.ketua_status),
      approvedBy: r.approved_by != null ? String(r.approved_by) : null,
      approvedAt: r.approved_at != null ? String(r.approved_at) : null,
    })),
  });
};

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  if (!data.user || data.user.role !== 'admin') {
    return jsonResponse({ success: false, error: 'Akses khusus admin.' }, 403);
  }

  let body: { siswaId?: string; classId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body harus berupa JSON.' }, 400);
  }

  const { siswaId, classId } = body;
  if (!siswaId || !classId) {
    return jsonResponse({ success: false, error: 'siswaId dan classId wajib diisi.' }, 400);
  }

  // Ambil data siswa dari koleksi siswa_v1
  const siswaArr = (await getCurrent(env.DB, 'siswa_v1')) as SiswaRow[] | null;
  const siswa = Array.isArray(siswaArr) ? siswaArr.find(s => s.id === siswaId) : undefined;
  if (!siswa) {
    return jsonResponse({ success: false, error: 'Siswa tidak ditemukan di koleksi siswa_v1.' }, 404);
  }

  const nisn = siswa.nisn;
  const email = `${nisn}@siswa.smksplusatthahirin.sch.id`;
  const passwordHash = await hashPassword(nisn); // password awal = NISN
  const now = new Date().toISOString();

  const existing = await env.DB.prepare('SELECT id FROM users WHERE nip_nisn = ?').bind(nisn).first();
  if (existing) {
    await env.DB.prepare(
      `UPDATE users
       SET role = 'ketua_kelas', class_id = ?, ketua_status = 'approved',
           approved_by = ?, approved_at = ?
       WHERE id = ?`
    ).bind(classId, data.user.id, now, String(existing.id)).run();
    return jsonResponse({ success: true, data: { id: String(existing.id), name: siswa.name } });
  }

  const newId = `u-${crypto.randomUUID()}`;
  await env.DB.prepare(
    `INSERT INTO users (id, name, email, nip_nisn, role, class_id, password_hash, jabatan, ketua_status, approved_by, approved_at, created_at)
     VALUES (?, ?, ?, ?, 'ketua_kelas', ?, ?, ?, 'approved', ?, ?, ?)`
  ).bind(
    newId,
    siswa.name,
    email,
    nisn,
    classId,
    passwordHash,
    `Ketua Kelas`,
    data.user.id,
    now,
    now
  ).run();

  return jsonResponse({ success: true, data: { id: newId, name: siswa.name } });
};

export const onRequestDelete: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  if (!data.user || data.user.role !== 'admin') {
    return jsonResponse({ success: false, error: 'Akses khusus admin.' }, 403);
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body harus berupa JSON.' }, 400);
  }

  const { userId } = body;
  if (!userId) {
    return jsonResponse({ success: false, error: 'userId wajib diisi.' }, 400);
  }

  await env.DB.prepare(
    `UPDATE users SET role = 'siswa', ketua_status = 'none', approved_by = NULL, approved_at = NULL WHERE id = ?`
  ).bind(userId).run();

  return jsonResponse({ success: true });
};