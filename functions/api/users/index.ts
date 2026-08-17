import { hashPassword, verifyPassword, type AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { prepareUserAudit, writeUserAudit } from '../../_lib/user-audit';
import { classExists, readCollection, rosterReplaceStatements, syncStudentRoster, type StudentRosterRecord } from '../../_lib/student-roster';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };
type ManagedRole = 'admin' | 'guru' | 'siswa';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT_FIELDS = `id, name, email, nip_nisn, nik, tanggal_lahir, role, class_id, jabatan,
  status, must_change_password, archived_at, created_at`;

function canManage(actor: AuthUser, targetRole: string): boolean {
  if (actor.role === 'super_admin') return ['admin', 'guru', 'siswa', 'ketua_kelas'].includes(targetRole);
  return actor.role === 'admin' && ['guru', 'siswa', 'ketua_kelas'].includes(targetRole);
}

function publicUser(row: any) {
  return {
    id: String(row.id), name: String(row.name), email: String(row.email),
    nipNisn: row.nip_nisn == null ? null : String(row.nip_nisn),
    nik: row.nik == null ? null : String(row.nik),
    tanggalLahir: row.tanggal_lahir == null ? null : String(row.tanggal_lahir),
    role: String(row.role), classId: row.class_id == null ? null : String(row.class_id),
    jabatan: row.jabatan == null ? null : String(row.jabatan),
    status: String(row.status || 'active'),
    mustChangePassword: Number(row.must_change_password || 0) === 1,
    archivedAt: row.archived_at == null ? null : String(row.archived_at),
    createdAt: String(row.created_at),
  };
}

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function getTarget(db: D1Database, id: string): Promise<any | null> {
  return db.prepare(`SELECT ${SELECT_FIELDS}, password_hash FROM users WHERE id = ?`).bind(id).first();
}

async function hasHistoricalReferences(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare(`SELECT
    EXISTS(SELECT 1 FROM cbt_exams WHERE teacher_user_id=?)
    + EXISTS(SELECT 1 FROM cbt_attempts WHERE student_user_id=?)
    + EXISTS(SELECT 1 FROM forum_topics WHERE author_user_id=?)
    + EXISTS(SELECT 1 FROM forum_replies WHERE author_user_id=?)
    + EXISTS(SELECT 1 FROM notifications WHERE sender_user_id=?)
    + EXISTS(SELECT 1 FROM whatsapp_outbox WHERE teacher_user_id=?) AS total`
  ).bind(userId, userId, userId, userId, userId, userId).first<{ total: number }>();
  return Number(row?.total || 0) > 0;
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user || !['super_admin', 'admin'].includes(data.user.role)) {
    return jsonResponse({ success: false, error: 'Akses khusus administrator.' }, 403);
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const role = url.searchParams.get('role');
  const clauses: string[] = ["role != 'super_admin'"];
  const binds: string[] = [];
  if (data.user.role !== 'super_admin') clauses.push("role NOT IN ('admin', 'super_admin')");
  if (status && status !== 'all') { clauses.push('status = ?'); binds.push(status); }
  if (role && role !== 'all') { clauses.push('role = ?'); binds.push(role); }
  const query = `SELECT ${SELECT_FIELDS} FROM users WHERE ${clauses.join(' AND ')} ORDER BY status, role, name`;
  const stmt = binds.length ? env.DB.prepare(query).bind(...binds) : env.DB.prepare(query);
  const { results } = await stmt.all();
  return jsonResponse({ success: true, data: results.map(publicUser) });
};

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  const actor = data.user;
  if (!actor || !['super_admin', 'admin'].includes(actor.role)) {
    return jsonResponse({ success: false, error: 'Akses khusus administrator.' }, 403);
  }
  let body: { name?: string; email?: string; identifier?: string; role?: ManagedRole; classId?: string; jabatan?: string; gender?: 'L' | 'P' };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const identifier = (body.identifier || '').trim();
  const role = body.role || 'siswa';
  if (!name || !email || !identifier || !canManage(actor, role)) {
    return jsonResponse({ success: false, error: 'Nama, email, nomor identitas, dan role yang valid wajib diisi.' }, 400);
  }
  if (!EMAIL_PATTERN.test(email)) return jsonResponse({ success: false, error: 'Format email tidak valid.' }, 400);
  if (role === 'siswa' && !/^\d{10}$/.test(identifier)) {
    return jsonResponse({ success: false, error: 'NISN siswa harus 10 digit angka.' }, 400);
  }
  if (role === 'siswa' && !['L', 'P'].includes(String(body.gender || ''))) {
    return jsonResponse({ success: false, error: 'Jenis kelamin siswa wajib diisi dengan L atau P.' }, 400);
  }
  const classId = (body.classId || '').trim();
  let roster: unknown[] | null = null;
  if (role === 'siswa') {
    if (!classId) return jsonResponse({ success: false, error: 'Kelas siswa wajib diisi.' }, 400);
    try {
      const [classes, currentRoster] = await Promise.all([
        readCollection(env.DB, 'kelas_v1'),
        readCollection(env.DB, 'siswa_v1'),
      ]);
      if (!classExists(classes, classId)) return jsonResponse({ success: false, error: 'Kelas siswa tidak ditemukan.' }, 400);
      roster = currentRoster;
    } catch (error) {
      return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Data roster tidak dapat diproses.' }, 500);
    }
  }
  const duplicate = await env.DB.prepare('SELECT id FROM users WHERE email = ? OR nip_nisn = ?').bind(email, identifier).first();
  if (duplicate) return jsonResponse({ success: false, error: 'Email atau nomor identitas sudah digunakan.' }, 409);
  const password = randomPassword();
  const id = `u-${crypto.randomUUID()}`;
  const insert = env.DB.prepare(
    `INSERT INTO users
      (id, name, email, nip_nisn, role, class_id, password_hash, jabatan, ketua_status, status, must_change_password, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'none', 'active', 1, ?)`
  ).bind(id, name, email, identifier, role, classId || null, await hashPassword(password), body.jabatan || null, new Date().toISOString());
  const created = { id, name, email, nipNisn: identifier, role, classId: classId || null, jabatan: body.jabatan || null, status: 'active' };
  const statements = [insert];
  if (role === 'siswa') {
    const nextRoster = syncStudentRoster(roster, { nisn: identifier, name, classId, gender: body.gender });
    statements.push(...rosterReplaceStatements(env.DB, nextRoster));
  }
  statements.push(prepareUserAudit(env.DB, actor, 'CREATE_USER', created, undefined, created));
  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error('Gagal membuat akun dan roster:', error);
    return jsonResponse({ success: false, error: 'Akun gagal dibuat. Tidak ada perubahan yang disimpan.' }, 500);
  }
  return jsonResponse({ success: true, data: created, initialPassword: password }, 201);
};

export const onRequestPatch: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  const actor = data.user;
  if (!actor || !['super_admin', 'admin'].includes(actor.role)) return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  let body: { id?: string; name?: string; email?: string; identifier?: string; role?: ManagedRole; classId?: string | null; jabatan?: string | null; status?: 'active' | 'inactive'; reason?: string; gender?: 'L' | 'P' };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (!body.id) return jsonResponse({ success: false, error: 'ID pengguna wajib diisi.' }, 400);
  const target = await getTarget(env.DB, body.id);
  if (!target) return jsonResponse({ success: false, error: 'Pengguna tidak ditemukan.' }, 404);
  if (!canManage(actor, String(target.role))) return jsonResponse({ success: false, error: 'Anda tidak boleh mengelola akun ini.' }, 403);
  const nextRole = body.role || String(target.role);
  if (!canManage(actor, nextRole)) return jsonResponse({ success: false, error: 'Anda tidak boleh menetapkan role tersebut.' }, 403);
  const next = {
    name: body.name?.trim() || String(target.name),
    email: body.email?.trim().toLowerCase() || String(target.email),
    identifier: body.identifier?.trim() || String(target.nip_nisn),
    role: nextRole,
    classId: body.classId === undefined ? target.class_id : body.classId?.trim() || null,
    jabatan: body.jabatan === undefined ? target.jabatan : body.jabatan,
    status: body.status || String(target.status),
  };
  if (!next.name.trim()) return jsonResponse({ success: false, error: 'Nama wajib diisi.' }, 400);
  if (!EMAIL_PATTERN.test(next.email)) return jsonResponse({ success: false, error: 'Format email tidak valid.' }, 400);
  const duplicate = await env.DB.prepare('SELECT id FROM users WHERE id != ? AND (email = ? OR nip_nisn = ?)')
    .bind(body.id, next.email, next.identifier).first();
  if (duplicate) return jsonResponse({ success: false, error: 'Email atau nomor identitas sudah digunakan.' }, 409);

  let rosterStatements: D1PreparedStatement[] = [];
  const studentIdentityChanged = next.role === 'siswa' && (
    String(target.role) !== 'siswa'
    || next.name !== String(target.name)
    || next.identifier !== String(target.nip_nisn)
    || next.classId !== target.class_id
  );
  if (studentIdentityChanged) {
    if (!/^\d{10}$/.test(next.identifier)) return jsonResponse({ success: false, error: 'NISN siswa harus 10 digit angka.' }, 400);
    if (!next.classId || typeof next.classId !== 'string') return jsonResponse({ success: false, error: 'Kelas siswa wajib diisi.' }, 400);
    try {
      const [classes, roster] = await Promise.all([
        readCollection(env.DB, 'kelas_v1'),
        readCollection(env.DB, 'siswa_v1'),
      ]);
      if (!classExists(classes, next.classId)) return jsonResponse({ success: false, error: 'Kelas siswa tidak ditemukan.' }, 400);
      if (String(target.role) !== 'siswa' && !['L', 'P'].includes(String(body.gender || ''))) {
        return jsonResponse({ success: false, error: 'Jenis kelamin wajib diisi saat mengubah akun menjadi siswa.' }, 400);
      }
      const nextRoster = syncStudentRoster(roster, {
        oldNisn: String(target.nip_nisn), nisn: next.identifier, name: next.name, classId: next.classId,
        gender: body.gender,
      });
      rosterStatements.push(...rosterReplaceStatements(env.DB, nextRoster));
    } catch (error) {
      return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Data roster tidak dapat diproses.' }, 500);
    }
  }
  if (String(target.role) === 'siswa' && next.role !== 'siswa') {
    const roster = await readCollection(env.DB, 'siswa_v1');
    rosterStatements.push(...rosterReplaceStatements(env.DB,
      (roster || []).filter(item => item && typeof item === 'object' && String((item as any).nisn) !== String(target.nip_nisn))));
  }
  const update = env.DB.prepare(
    `UPDATE users SET name = ?, email = ?, nip_nisn = ?, role = ?, class_id = ?, jabatan = ?, status = ?,
      archived_at = CASE WHEN ? = 'active' THEN NULL ELSE archived_at END WHERE id = ?`
  ).bind(next.name, next.email, next.identifier, next.role, next.classId, next.jabatan, next.status, next.status, body.id);
  const statements = [update, ...rosterStatements];
  statements.push(prepareUserAudit(env.DB, actor, 'UPDATE_USER', { id: body.id, name: next.name }, publicUser(target), next, body.reason));
  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error('Gagal memperbarui akun dan roster:', error);
    return jsonResponse({ success: false, error: 'Akun gagal diperbarui. Tidak ada perubahan yang disimpan.' }, 500);
  }
  return jsonResponse({ success: true, data: { id: body.id, ...next } });
};

export const onRequestDelete: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  const actor = data.user;
  if (!actor || !['super_admin', 'admin'].includes(actor.role)) return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  let body: { id?: string; reason?: string; permanent?: boolean; password?: string };
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (!body.id || !body.reason?.trim()) return jsonResponse({ success: false, error: 'ID dan alasan wajib diisi.' }, 400);
  const target = await getTarget(env.DB, body.id);
  if (!target) return jsonResponse({ success: false, error: 'Pengguna tidak ditemukan.' }, 404);
  if (!canManage(actor, String(target.role))) return jsonResponse({ success: false, error: 'Anda tidak boleh mengelola akun ini.' }, 403);

  if (body.permanent) {
    if (actor.role !== 'super_admin') return jsonResponse({ success: false, error: 'Hapus permanen hanya untuk Super Admin.' }, 403);
    const actorRow = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(actor.id).first();
    if (!body.password || !actorRow || !(await verifyPassword(body.password, String(actorRow.password_hash)))) {
      return jsonResponse({ success: false, error: 'Password Super Admin tidak valid.' }, 401);
    }
    if (String(target.status) !== 'archived') return jsonResponse({ success: false, error: 'Akun harus diarsipkan terlebih dahulu.' }, 409);
    const references = await env.DB.prepare('SELECT COUNT(*) AS total FROM app_data WHERE value LIKE ?').bind(`%${body.id}%`).first();
    if (Number(references?.total || 0) > 0 || await hasHistoricalReferences(env.DB, body.id)) {
      return jsonResponse({ success: false, error: 'Akun memiliki data historis dan tidak dapat dihapus permanen.' }, 409);
    }
    await writeUserAudit(env.DB, actor, 'DELETE_USER_PERMANENT', { id: body.id, name: String(target.name) }, publicUser(target), undefined, body.reason);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.id),
      env.DB.prepare('DELETE FROM forum_topic_likes WHERE user_id = ?').bind(body.id),
      env.DB.prepare('DELETE FROM notification_reads WHERE user_id = ?').bind(body.id),
      env.DB.prepare('DELETE FROM teacher_whatsapp_settings WHERE teacher_user_id = ?').bind(body.id),
      env.DB.prepare('UPDATE guardian_contacts SET updated_by = NULL WHERE updated_by = ?').bind(body.id),
      env.DB.prepare('UPDATE whatsapp_settings SET updated_by = NULL WHERE updated_by = ?').bind(body.id),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(body.id),
    ]);
    return jsonResponse({ success: true });
  }

  await env.DB.prepare("UPDATE users SET status = 'archived', archived_at = ?, archived_by = ? WHERE id = ?")
    .bind(new Date().toISOString(), actor.id, body.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.id).run();
  await writeUserAudit(env.DB, actor, 'ARCHIVE_USER', { id: body.id, name: String(target.name) }, publicUser(target), { status: 'archived' }, body.reason);
  return jsonResponse({ success: true });
};
