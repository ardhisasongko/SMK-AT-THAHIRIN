import { getUserById, getUserFromRequest, type AuthEnv } from '../../../_lib/auth';
import { readCollection, rosterReplaceStatements } from '../../../_lib/student-roster';
import { jsonResponse } from '../../../_lib/response';

interface Env extends AuthEnv {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Perbarui profil sendiri (nama/email). Siswa/ketua_kelas yang mengganti nama
// ikut disinkronkan ke roster siswa_v1 agar daftar kelas tetap konsisten.
export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonResponse({ success: false, error: 'Tidak terautentikasi.' }, 401);

  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ success: false, error: 'Body tidak valid.' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
  if (name === undefined && email === undefined) return jsonResponse({ success: false, error: 'Tidak ada perubahan.' }, 400);
  if (name !== undefined && (name.length < 1 || name.length > 100)) return jsonResponse({ success: false, error: 'Nama harus 1–100 karakter.' }, 400);
  if (email !== undefined && (email.length > 100 || !EMAIL_RE.test(email))) return jsonResponse({ success: false, error: 'Email tidak valid.' }, 400);

  const statements: D1PreparedStatement[] = [];

  if (email !== undefined && email !== user.email) {
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').bind(email, user.id).first<any>();
    if (existing) return jsonResponse({ success: false, error: 'Email sudah dipakai akun lain.' }, 409);
  }

  const isStudentRole = user.role === 'siswa' || user.role === 'ketua_kelas';
  if (isStudentRole && name !== undefined && name !== user.name && user.nipNisn) {
    const roster = await readCollection(env.DB, 'siswa_v1');
    const nextRoster = (roster || []).map(item =>
      item && typeof item === 'object' && String((item as any).nisn) === user.nipNisn
        ? { ...(item as Record<string, unknown>), name }
        : item
    );
    if (JSON.stringify(nextRoster) !== JSON.stringify(roster)) {
      statements.push(...rosterReplaceStatements(env.DB, nextRoster));
    }
  }

  statements.push(env.DB.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').bind(name ?? user.name, email ?? user.email, user.id));
  await env.DB.batch(statements);

  const updated = await getUserById(env, user.id);
  return jsonResponse({ success: true, user: updated });
};