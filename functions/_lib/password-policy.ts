/**
 * Kebijakan password tunggal untuk SEMUA jalur penetapan password
 * (buat pengguna, impor CSV, reset admin, ganti sendiri, password awal).
 *
 * Aturan:
 * - 10–200 karakter, wajib mengandung huruf dan angka.
 * - Tidak boleh sama dengan — atau mengandung — identifier (NISN/NIP),
 *   email, bagian lokal email, atau nama pengguna: pola yang dapat ditebak
 *   dari data pengguna adalah vektor serangan pertama pada akun sekolah.
 * - Password awal yang dibuat sistem selalu acak kriptografis (generator di
 *   file ini, rejection sampling tanpa bias modulo) dan lolos kebijakan.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

export interface PasswordContext {
  identifier?: string | null;
  email?: string | null;
  name?: string | null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Mengembalikan pesan error (Bahasa Indonesia) atau null bila lolos. */
export function validateNewPassword(password: string, context: PasswordContext = {}): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password maksimal ${MAX_PASSWORD_LENGTH} karakter.`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password harus mengandung kombinasi huruf dan angka.';
  }
  const normalizedPassword = normalize(password);
  const forbiddenSources: Array<[string, string | null | undefined]> = [
    ['nomor identitas (NISN/NIP)', context.identifier],
    ['email', context.email],
    ['email', context.email ? context.email.split('@')[0] : null],
    ['nama', context.name],
  ];
  for (const [label, raw] of forbiddenSources) {
    if (!raw) continue;
    const value = normalize(String(raw));
    // Nilai terlalu pendek (<5) diabaikan agar tidak menolak password sah
    // secara tidak sengaja; identifier sekolah selalu >= 10 digit.
    if (value.length < 5) continue;
    if (normalizedPassword === value || normalizedPassword.includes(value)) {
      return `Password tidak boleh sama dengan atau mengandung ${label} Anda.`;
    }
  }
  return null;
}

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';

/** Ambil indeks acak 0..maxExclusive tanpa bias modulo (rejection sampling). */
function randomIndex(maxExclusive: number): number {
  const limit = Math.floor(256 / maxExclusive) * maxExclusive;
  const buffer = new Uint8Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}

/**
 * Password awal/reset acak 16 karakter dari generator kriptografis.
 * Dijamin mengandung huruf, angka, dan simbol — selalu lolos kebijakan.
 */
export function generateRandomPassword(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let password = '';
    for (let i = 0; i < 16; i++) password += PASSWORD_CHARS[randomIndex(PASSWORD_CHARS.length)];
    if (/[A-Za-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
      return password;
    }
  }
  // Secara statistik mustahil tercapai; tetap kembalikan kandidat terakhir.
  return `A1!${Array.from({ length: 13 }, () => PASSWORD_CHARS[randomIndex(PASSWORD_CHARS.length)]).join('')}`;
}
