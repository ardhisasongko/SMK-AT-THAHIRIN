/**
 * Client auth utilities untuk SMKS PLUS AT THAHIRIN.
 * Autentikasi dilakukan SERVER (Pages Functions + D1); file ini hanya
 * menyimpan profil tampilan dan validasi ringan sisi client. Token sesi berada
 * di cookie HttpOnly agar tidak dapat dibaca JavaScript.
 */

import { AuthSession } from '../types';

const AUTH_STORAGE_KEY = 'smk_auth';

export function saveAuthSession(session: AuthSession): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: session.user }));
  } catch (e) {
    console.error('Gagal menyimpan sesi:', e);
  }
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.user) return null;
    return { user: parsed.user } as AuthSession;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return null;
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    console.error('Gagal menghapus sesi:', e);
  }
}

/** Cookie HttpOnly dikirim otomatis untuk request same-origin. */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return extra;
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
      user?: {
        id: string; name: string; email: string; role: string;
        nipNisn?: string | null; classId?: string | null;
         jabatan?: string | null; ketuaStatus?: string; status?: string;
         mustChangePassword?: boolean;
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
      status: (json.user!.status || 'active') as AuthSession['user']['status'],
      mustChangePassword: Boolean(json.user!.mustChangePassword),
    };
    return { ok: true, session: { user } };
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
  return 'Password minimal 8 karakter';
}

/**
 * Validate password strength
 */
export function isPasswordStrong(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password minimal 8 karakter' };
  }
  return { valid: true, message: 'Password valid' };
}
