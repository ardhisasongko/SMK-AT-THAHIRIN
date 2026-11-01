/**
 * Client auth utilities untuk sistem informasi sekolah.
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

interface LoginUserPayload {
  id: string; name: string; email: string; role: string;
  nipNisn?: string | null; classId?: string | null;
  jabatan?: string | null; ketuaStatus?: string; status?: string;
  mustChangePassword?: boolean;
}

function mapLoginUser(payload: LoginUserPayload): AuthSession['user'] {
  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role as AuthSession['user']['role'],
    avatar: '',
    nipNisn: payload.nipNisn || undefined,
    classId: payload.classId || undefined,
    jabatan: payload.jabatan || undefined,
    ketuaStatus: (payload.ketuaStatus || 'none') as AuthSession['user']['ketuaStatus'],
    status: (payload.status || 'active') as AuthSession['user']['status'],
    mustChangePassword: Boolean(payload.mustChangePassword),
  };
}

/**
 * Login ke server. Untuk akun staf dengan 2FA aktif, server menjawab
 * `twoFactorRequired` + token tantangan — sesi baru dibuat setelah
 * verifyTwoFactorRequest() berhasil.
 */
export async function loginRequest(
  identifier: string,
  password: string
): Promise<{ ok: boolean; error?: string; session?: AuthSession; twoFactorRequired?: boolean; challengeToken?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const json = await res.json() as {
      success?: boolean;
      error?: string;
      twoFactorRequired?: boolean;
      challengeToken?: string;
      user?: LoginUserPayload;
    };
    if (!res.ok || !json.success) {
      return { ok: false, error: json.error || 'Login gagal.' };
    }
    if (json.twoFactorRequired && json.challengeToken) {
      return { ok: true, twoFactorRequired: true, challengeToken: json.challengeToken };
    }
    return { ok: true, session: { user: mapLoginUser(json.user!) } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Gagal terhubung ke server.' };
  }
}

/** Langkah kedua login: tukar token tantangan + kode TOTP/kode pemulihan menjadi sesi. */
export async function verifyTwoFactorRequest(
  challengeToken: string,
  code: string
): Promise<{ ok: boolean; error?: string; session?: AuthSession }> {
  try {
    const res = await fetch('/api/auth/login/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken, code }),
    });
    const json = await res.json() as {
      success?: boolean;
      error?: string;
      user?: LoginUserPayload;
    };
    if (!res.ok || !json.success || !json.user) {
      return { ok: false, error: json.error || 'Verifikasi dua langkah gagal.' };
    }
    return { ok: true, session: { user: mapLoginUser(json.user) } };
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
  return 'Password minimal 10 karakter dengan kombinasi huruf dan angka, dan tidak boleh sama dengan NISN/NIP, email, atau nama Anda';
}

/**
 * Validate password strength — selaras kebijakan server (hardening Fase B).
 * Catatan: fungsi ini TIDAK dipakai memblokir login (password lama yang
 * masih sah tetap harus bisa masuk); hanya untuk form penetapan password
 * baru (ganti password, dsb).
 */
export function isPasswordStrong(password: string): { valid: boolean; message: string } {
  if (password.length < 10) {
    return { valid: false, message: 'Password minimal 10 karakter' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'Password harus mengandung kombinasi huruf dan angka' };
  }
  return { valid: true, message: 'Password valid' };
}

/**
 * Kebijakan refresh sesi saat cek /api/auth/me gagal:
 * hanya 401 (sesi kadaluarsa/tidak valid) yang boleh menghapus sesi lokal.
 * Error jaringan atau gangguan server (5xx) dipertahankan agar user
 * tidak tiba-tiba ter-logout di koneksi yang tidak stabil.
 */
export function shouldClearSessionOnAuthCheck(status: number): boolean {
  return status === 401;
}
