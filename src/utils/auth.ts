/**
 * Client auth utilities untuk SMK AT-THAHIRIN.
 * Autentikasi dilakukan SERVER (Pages Functions + D1); file ini hanya
 * mengelola token sesi di browser & validasi ringan sisi client.
 */

import { AuthSession } from '../types';

const AUTH_STORAGE_KEY = 'smk_auth';

// Password demo untuk tombol login cepat (identik dengan seed users di D1)
export const DEMO_CREDENTIALS = {
  admin: { identifier: 'admin@smksplusatthahirin.sch.id', password: 'admin123' },
  guru: { identifier: 'guru@smksplusatthahirin.sch.id', password: 'guru123' },
  siswa: { identifier: 'siswa@smksplusatthahirin.sch.id', password: 'siswa123' },
  ketua: { identifier: 'ketua@smksplusatthahirin.sch.id', password: 'ketua123' },
} as const;

export function saveAuthSession(session: AuthSession): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Gagal menyimpan sesi:', e);
  }
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.token || !parsed.user) return null;
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return loadAuthSession()?.token ?? null;
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    console.error('Gagal menghapus sesi:', e);
  }
}

/** Header Authorization untuk dipakai di fetch. */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Login ke server, kirimkan token + user bila sukses. */
export async function loginRequest(
  identifier: string,
  password: string
): Promise<{ ok: boolean; error?: string; session?: AuthSession }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const json = await res.json() as {
      success?: boolean;
      error?: string;
      token?: string;
      user?: {
        id: string; name: string; email: string; role: string;
        nipNisn?: string | null; classId?: string | null;
        jabatan?: string | null; ketuaStatus?: string;
      };
    };
    if (!res.ok || !json.success) {
      return { ok: false, error: json.error || 'Login gagal.' };
    }
    const user: AuthSession['user'] = {
      id: json.user!.id,
      name: json.user!.name,
      email: json.user!.email,
      role: json.user!.role as AuthSession['user']['role'],
      avatar: '',
      nipNisn: json.user!.nipNisn || undefined,
      classId: json.user!.classId || undefined,
      jabatan: json.user!.jabatan || undefined,
      ketuaStatus: (json.user!.ketuaStatus || 'none') as AuthSession['user']['ketuaStatus'],
    };
    return { ok: true, session: { token: json.token!, user } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Gagal terhubung ke server.' };
  }
}

export async function logoutRequest(token: string | null): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // abaikan
  }
}

export function getPasswordRequirements(): string {
  return 'Password minimal 6 karakter';
}

/**
 * Info kredensial demo untuk ditampilkan di UI.
 */
export function getDefaultCredentialsInfo() {
  return [
    { role: 'Admin', email: 'admin@smksplusatthahirin.sch.id', password: 'admin123' },
    { role: 'Guru', email: 'guru@smksplusatthahirin.sch.id', password: 'guru123' },
    { role: 'Ketua Kelas', email: 'ketua@smksplusatthahirin.sch.id', password: 'ketua123' },
    { role: 'Siswa', email: 'siswa@smksplusatthahirin.sch.id', password: 'siswa123' },
  ];
}

/**
 * Validate password strength
 */
export function isPasswordStrong(password: string): { valid: boolean; message: string } {
  if (password.length < 6) {
    return { valid: false, message: 'Password minimal 6 karakter' };
  }
  return { valid: true, message: 'Password valid' };
}