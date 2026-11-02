/**
 * Kartu QR presensi siswa (Model A: guru/piket memindai kartu siswa).
 *
 * Payload kartu adalah satu string ringkas: `SMKQR1:<nisn>:<sig>`.
 * `sig` adalah potongan HMAC-SHA256 atas `SMKQR1:<nisn>` memakai secret
 * server `QR_CARD_SECRET` (16 byte pertama digest, base64url = 22 karakter,
 * setara 128 bit — cukup kuat dan menjaga QR tetap kecil/mudah dipindai).
 *
 * Payload HANYA dibuat oleh server; secret tidak pernah dikirim ke klien
 * selain sebagai QR jadi. Tanpa `QR_CARD_SECRET`, fitur nonaktif secara
 * aman (fail-closed): endpoint kartu melaporkan `configured: false` dan
 * endpoint pindai menolak 503 — mencontoh pola 2FA (TOTP_ENCRYPTION_KEY).
 *
 * Rotasi `QR_CARD_SECRET` membuat SEMUA kartu lama tidak berlaku lagi;
 * kartu harus diterbitkan/dicetak ulang setelah rotasi.
 */

import { secretEquals } from './secret-compare';

export interface QrCardEnv {
  QR_CARD_SECRET?: string;
}

export const QR_PAYLOAD_PREFIX = 'SMKQR1';

/** Panjang potongan tanda tangan (byte digest) yang dipakai. */
const SIGNATURE_BYTES = 16;

export function isQrCardConfigured(env: QrCardEnv): boolean {
  return typeof env.QR_CARD_SECRET === 'string' && env.QR_CARD_SECRET.length >= 16;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signatureFor(env: QrCardEnv, nisn: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.QR_CARD_SECRET || ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${QR_PAYLOAD_PREFIX}:${nisn}`),
  );
  return toBase64Url(new Uint8Array(digest).slice(0, SIGNATURE_BYTES));
}

/** Susun payload kartu QR untuk satu NISN. Pemanggil wajib cek konfigurasi. */
export async function buildQrCardPayload(env: QrCardEnv, nisn: string): Promise<string> {
  return `${QR_PAYLOAD_PREFIX}:${nisn}:${await signatureFor(env, nisn)}`;
}

export interface ParsedQrPayload {
  nisn: string;
  signature: string;
}

/** Parse ketat format payload; null bila bentuknya asing/rusak. */
export function parseQrCardPayload(raw: unknown): ParsedQrPayload | null {
  if (typeof raw !== 'string') return null;
  const parts = raw.trim().split(':');
  if (parts.length !== 3) return null;
  const [prefix, nisn, signature] = parts;
  if (prefix !== QR_PAYLOAD_PREFIX) return null;
  if (!/^\d{4,20}$/.test(nisn)) return null;
  if (!/^[A-Za-z0-9_-]{22}$/.test(signature)) return null;
  return { nisn, signature };
}

export interface QrStudentRow {
  id: string;
  nisn: string;
  name: string;
  classId: string;
  className: string;
}

/** Cari siswa aktif berdasarkan NISN (dipakai endpoint kartu & pindai). */
export async function findActiveStudentByNisn(db: D1Database, nisn: string): Promise<QrStudentRow | null> {
  const row = await db.prepare(
    `SELECT s.id, s.nisn, s.name, s.class_id, c.name AS class_name
       FROM students s LEFT JOIN school_classes c ON c.id = s.class_id
      WHERE s.nisn = ? AND s.active = 1`
  ).bind(nisn).first<any>();
  if (!row) return null;
  return {
    id: String(row.id),
    nisn: String(row.nisn),
    name: String(row.name),
    classId: String(row.class_id),
    className: row.class_name ? String(row.class_name) : String(row.class_id),
  };
}

/**
 * Verifikasi payload hasil pindai: format harus sah DAN tanda tangan harus
 * cocok dengan HMAC server untuk NISN tersebut (konstan-waktu). Mengembalikan
 * NISN terverifikasi, atau null bila payload asing/palsu/rusak.
 */
export async function verifyQrCardPayload(env: QrCardEnv, raw: unknown): Promise<{ nisn: string } | null> {
  const parsed = parseQrCardPayload(raw);
  if (!parsed) return null;
  const expected = await signatureFor(env, parsed.nisn);
  if (!(await secretEquals(parsed.signature, expected))) return null;
  return { nisn: parsed.nisn };
}
