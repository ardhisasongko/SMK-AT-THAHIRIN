/**
 * Auth utility untuk Pages Functions (Cloudflare).
 * - Password hashing PBKDF2 (Web Crypto)
 * - Sesi berbasis token (tabel sessions di D1)
 * - Helper role / RBAC
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  nipNisn: string | null;
  nik: string | null;
  tanggalLahir: string | null;
  role: 'admin' | 'guru' | 'ketua_kelas' | 'siswa';
  classId: string | null;
  ketuaStatus: string;
  jabatan: string | null;
}

export interface AuthEnv {
  DB: D1Database;
}

const ITERATIONS = 100_000;
const KEY_LEN = 32;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN * 8
  );
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = fromHex(parts[2]);
  const expected = parts[3];
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN * 8
  );
  return toHex(new Uint8Array(bits)) === expected;
}

export function createToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'st_' + toHex(bytes);
}

export async function createSession(env: AuthEnv, userId: string): Promise<string> {
  const token = createToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, userId, expiresAt).run();
  return token;
}

export async function deleteSession(env: AuthEnv, token: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

function mapUser(row: any): AuthUser | null {
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    nipNisn: row.nip_nisn != null ? String(row.nip_nisn) : null,
    nik: row.nik != null ? String(row.nik) : null,
    tanggalLahir: row.tanggal_lahir != null ? String(row.tanggal_lahir) : null,
    role: row.role as AuthUser['role'],
    classId: row.class_id != null ? String(row.class_id) : null,
    ketuaStatus: String(row.ketua_status || 'none'),
    jabatan: row.jabatan != null ? String(row.jabatan) : null,
  };
}

export async function getUserById(env: AuthEnv, userId: string): Promise<AuthUser | null> {
  const row = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.nip_nisn, u.nik, u.tanggal_lahir, u.role, u.class_id, u.ketua_status, u.jabatan
     FROM users u WHERE u.id = ?`
  ).bind(userId).first();
  return mapUser(row);
}

export async function getUserFromRequest(env: AuthEnv, request: Request): Promise<AuthUser | null> {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;

  const session = await env.DB.prepare(
    'SELECT user_id, expires_at FROM sessions WHERE token = ?'
  ).bind(token).first();
  if (!session) return null;

  const expiresAt = new Date(String(session.expires_at)).getTime();
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return null;

  return getUserById(env, String(session.user_id));
}

/** Cek apakah user berhak menulis absensi untuk suatu kelas. */
export function canEditClass(user: AuthUser, classId: string): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'guru') return true;
  if (user.role === 'ketua_kelas') {
    return user.ketuaStatus === 'approved' && user.classId === classId;
  }
  return false;
}

/** Kelas yang boleh diedit user (untuk pembatasan dropdown di client & validasi server). */
export function editableClassIds(user: AuthUser): string[] | 'all' {
  if (user.role === 'admin') return 'all';
  if (user.role === 'guru') return 'all'; // guru dibatasi per waliKelas di validasi via nama
  if (user.role === 'ketua_kelas' && user.ketuaStatus === 'approved' && user.classId) {
    return [user.classId];
  }
  return [];
}
