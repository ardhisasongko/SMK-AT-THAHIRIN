/**
 * Verifikasi dua langkah TOTP (RFC 6238) untuk Pages Functions.
 *
 * - Algoritme standar: HMAC-SHA-1, periode 30 detik, 6 digit — kompatibel
 *   dengan Google Authenticator, Microsoft Authenticator, Authy, dll.
 * - Secret pengguna TIDAK disimpan plaintext: dienkripsi AES-GCM dengan
 *   kunci yang diturunkan (SHA-256) dari secret server TOTP_ENCRYPTION_KEY.
 *   Tanpa secret itu fitur 2FA nonaktif secara aman (fail-closed di langkah
 *   verifikasi) dan endpoint penyiapan menolak dengan 503.
 * - Kode pemulihan sekali pakai disimpan sebagai hash SHA-256.
 */

export const TWO_FACTOR_ROLES = ['guru', 'admin', 'super_admin'] as const;

export interface TotpEnv {
  TOTP_ENCRYPTION_KEY?: string;
  APP_NAME?: string;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Karakter base32 tidak valid.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

/** Secret TOTP baru: 20 byte acak (160 bit) dalam base32. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

/** Kode TOTP 6 digit untuk satu langkah waktu (default: langkah saat ini). */
export async function computeTotp(secretBase32: string, counter?: number): Promise<string> {
  const step = counter ?? Math.floor(Date.now() / 1000 / 30);
  const message = new Uint8Array(8);
  const view = new DataView(message.buffer);
  view.setUint32(4, step >>> 0);
  view.setUint32(0, Math.floor(step / 0x1_0000_0000));
  const mac = await hmacSha1(base32Decode(secretBase32), message);
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | ((mac[offset + 1] & 0xff) << 16)
    | ((mac[offset + 2] & 0xff) << 8) | (mac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

function codesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/**
 * Verifikasi kode pengguna dengan toleransi ±1 langkah (beda jam perangkat).
 * Mengembalikan langkah yang cocok agar pemanggil dapat menolak pemakaian
 * ulang kode pada langkah yang sama, atau null bila tidak ada yang cocok.
 */
export async function verifyTotp(secretBase32: string, code: string): Promise<number | null> {
  const normalized = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(normalized)) return null;
  const current = Math.floor(Date.now() / 1000 / 30);
  for (const step of [current, current - 1, current + 1]) {
    if (codesEqual(await computeTotp(secretBase32, step), normalized)) return step;
  }
  return null;
}

/** URL otpauth:// untuk dipindai / disalin ke aplikasi authenticator. */
export function buildOtpAuthUrl(env: TotpEnv, accountLabel: string, secretBase32: string): string {
  const issuer = (env.APP_NAME || 'Portal Sekolah').trim() || 'Portal Sekolah';
  const label = `${issuer}:${accountLabel}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function isTotpConfigured(env: TotpEnv): boolean {
  return typeof env.TOTP_ENCRYPTION_KEY === 'string' && env.TOTP_ENCRYPTION_KEY.length >= 16;
}

async function encryptionKey(env: TotpEnv): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`totp:${env.TOTP_ENCRYPTION_KEY || ''}`);
  const digest = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Enkripsi secret TOTP untuk disimpan di D1. Format: `v1:<iv b64>:<ct b64>`. */
export async function encryptTotpSecret(env: TotpEnv, secretBase32: string): Promise<string> {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(secretBase32),
  );
  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
}

/** Dekripsi secret TOTP; null bila format/kunci tidak cocok. */
export async function decryptTotpSecret(env: TotpEnv, stored: string): Promise<string | null> {
  try {
    const [version, ivText, cipherText] = stored.split(':');
    if (version !== 'v1' || !ivText || !cipherText) return null;
    const key = await encryptionKey(env);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivText) },
      key,
      fromBase64(cipherText),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Hash SHA-256 hex — dipakai untuk token tantangan & kode pemulihan. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Satu kode pemulihan terbaca: format `XXXX-XXXX` (8 karakter). */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, b => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Normalisasi kode pemulihan yang diketik pengguna sebelum di-hash. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
