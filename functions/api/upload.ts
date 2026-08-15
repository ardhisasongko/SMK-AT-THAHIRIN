// Upload foto presensi, disimpan di D1 (tanpa R2, tanpa biaya). Butuh login.
//   POST /api/upload            -> upload foto FULL, membuat baris photos (data=full).
//   POST /api/upload?id=<id>    -> upload THUMBNAIL kecil, menempel ke baris yang sama (thumb).
// Full base64 hanya sementara (<=24 jam): Worker cron harian memindahkannya ke Google Drive
// lalu mengosongkan kolom `data` (thumbnail tetap di D1 selamanya).
//
// Hasil: url = "/api/photo/<id>" yang disajikan oleh photo/[id].ts.

import { type AuthUser } from '../_lib/auth';
import { jsonResponse } from '../_lib/response';
import { consumeRateLimit } from '../_lib/rate-limit';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  if (!data.user) {
    return jsonResponse({ success: false, error: 'Silakan login terlebih dahulu.' }, 401);
  }

  const url = new URL(request.url);
  const attachId = url.searchParams.get('id');

  if (!attachId && !(await consumeRateLimit(env.DB, `upload:${data.user.id}`, 10, 60 * 60))) {
    return jsonResponse({ success: false, error: 'Batas upload per jam tercapai.' }, 429);
  }

  if (!attachId) {
    const daily = await env.DB.prepare("SELECT COUNT(*) AS total FROM photos WHERE created_by = ? AND created_at >= datetime('now', '-1 day')")
      .bind(data.user.id).first<{ total: number }>();
    if (Number(daily?.total || 0) >= 20) {
      return jsonResponse({ success: false, error: 'Batas 20 foto per hari tercapai.' }, 429);
    }
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 2 * 1024 * 1024) {
    return jsonResponse({ success: false, error: 'Ukuran foto melebihi 2MB.' }, 413);
  }
  const bytes = await request.arrayBuffer();
  const sizeMB = bytes.byteLength / (1024 * 1024);

  if (sizeMB > 2) {
    return jsonResponse({ success: false, error: 'Ukuran foto melebihi 2MB.' }, 413);
  }
  if (sizeMB === 0) {
    return jsonResponse({ success: false, error: 'Tidak ada data foto.' }, 400);
  }
  const contentType = detectImageMime(new Uint8Array(bytes));
  if (!contentType) {
    return jsonResponse({ success: false, error: 'File harus berupa gambar JPEG, PNG, atau WebP yang valid.' }, 415);
  }

  try {
    const base64 = bytesToBase64(new Uint8Array(bytes));

    if (attachId) {
      // Lampirkan thumbnail ke foto yang sudah ada
      const row = await env.DB
        .prepare('SELECT id FROM photos WHERE id = ? AND created_by = ?')
        .bind(attachId, data.user.id)
        .first<{ id: string }>();
      if (!row) {
        return jsonResponse({ success: false, error: 'Foto tidak ditemukan.' }, 404);
      }
      await env.DB
        .prepare('UPDATE photos SET thumb = ?, mime = ? WHERE id = ?')
        .bind(base64, contentType, attachId)
        .run();
      return jsonResponse({ success: true, id: attachId, url: `/api/photo/${attachId}` });
    }

    // Foto full baru
    const id = crypto.randomUUID();
    const inserted = await env.DB
      .prepare(`INSERT INTO photos (id, data, mime, created_by)
        SELECT ?, ?, ?, ?
        WHERE (SELECT COUNT(*) FROM photos WHERE created_by = ? AND created_at >= datetime('now', '-1 day')) < 20`)
      .bind(id, base64, contentType, data.user.id, data.user.id)
      .run();
    if (Number(inserted.meta?.changes || 0) === 0) {
      return jsonResponse({ success: false, error: 'Batas 20 foto per hari tercapai.' }, 429);
    }
    return jsonResponse({ success: true, id, url: `/api/photo/${id}` });
  } catch (e: any) {
    console.error('Upload gagal:', e);
    return jsonResponse({ success: false, error: 'Upload foto gagal. Penyimpanan belum tersedia.' }, 500);
  }
};
