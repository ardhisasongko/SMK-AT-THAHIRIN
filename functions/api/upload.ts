// Upload foto presensi, disimpan di D1 (tanpa R2, tanpa biaya). Butuh login.
//   POST /api/upload            -> upload foto FULL, membuat baris photos (data=full).
//   POST /api/upload?id=<id>    -> upload THUMBNAIL kecil, menempel ke baris yang sama (thumb).
// Full base64 hanya sementara (<=24 jam): Worker cron harian memindahkannya ke Google Drive
// lalu mengosongkan kolom `data` (thumbnail tetap di D1 selamanya).
//
// Hasil: url = "/api/photo/<id>" yang disajikan oleh photo/[id].ts.

import { jsonResponse, type AuthUser } from '../_lib/auth';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

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

  const contentType = request.headers.get('Content-Type') || 'image/jpeg';
  const bytes = await request.arrayBuffer();
  const sizeMB = bytes.byteLength / (1024 * 1024);

  if (sizeMB > 5) {
    return jsonResponse({ success: false, error: 'Ukuran foto melebihi 5MB.' }, 413);
  }
  if (sizeMB === 0) {
    return jsonResponse({ success: false, error: 'Tidak ada data foto.' }, 400);
  }

  try {
    const base64 = bytesToBase64(new Uint8Array(bytes));

    if (attachId) {
      // Lampirkan thumbnail ke foto yang sudah ada
      const row = await env.DB
        .prepare('SELECT id FROM photos WHERE id = ?')
        .bind(attachId)
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
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await env.DB
      .prepare('INSERT INTO photos (id, data, mime, created_by) VALUES (?, ?, ?, ?)')
      .bind(id, base64, contentType, data.user.id)
      .run();
    return jsonResponse({ success: true, id, url: `/api/photo/${id}` });
  } catch (e: any) {
    console.error('Upload gagal:', e);
    return jsonResponse({ success: false, error: 'Upload foto gagal. Penyimpanan belum tersedia.' }, 500);
  }
};