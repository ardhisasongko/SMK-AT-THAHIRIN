// Menyajikan foto presensi dari D1. Butuh login (token Bearer).
//   GET /api/photo/:id          -> foto FULL (base64 sementara, hanya ada <=24 jam)
//   GET /api/photo/:id?thumb=1  -> thumbnail kecil (permanen di D1, cepat untuk UI)
//   GET /api/photo/:id?link=1   -> redirect ke foto full di Google Drive (bila sudah diarsip),
//                                  atau fallback balas bytes full bila belum diarsipkan.

import { type AuthUser } from '../../_lib/auth';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, params, request, data }) => {
  if (!data.user) {
    return new Response(JSON.stringify({ success: false, error: 'Silakan login terlebih dahulu.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params as { id?: string };
  if (!id) {
    return new Response('id tidak ditemukan.', { status: 400 });
  }

  const url = new URL(request.url);
  const wantThumb = url.searchParams.get('thumb') === '1';
  const wantLink = url.searchParams.get('link') === '1';

  const row = await env.DB
    .prepare('SELECT data, thumb, mime, drive_link, created_by FROM photos WHERE id = ?')
    .bind(String(id))
    .first<{ data: string | null; thumb: string | null; mime: string; drive_link: string | null; created_by: string | null }>();

  if (!row) {
    return new Response('Foto tidak ditemukan.', { status: 404 });
  }
  if (data.user.role === 'siswa' && row.created_by !== data.user.id) {
    return new Response('Anda tidak berwenang melihat foto ini.', { status: 403 });
  }
  if (data.user.role === 'ketua_kelas' && row.created_by !== data.user.id) {
    const attendanceRow = await env.DB.prepare("SELECT value FROM app_data WHERE key = 'presensi_v1'").first<{ value: string }>();
    const attendance = attendanceRow ? JSON.parse(attendanceRow.value) as Array<{ classId?: string; fotoUrl?: string }> : [];
    if (!attendance.some(item => item.classId === data.user!.classId && item.fotoUrl === `/api/photo/${id}`)) {
      return new Response('Anda tidak berwenang melihat foto ini.', { status: 403 });
    }
  }

  const payload = wantThumb ? row.thumb : row.data || row.thumb;
  if (!payload) {
    return new Response(wantLink && row.drive_link ? 'Foto arsip hanya tersedia untuk operator Drive sekolah.' : 'Foto belum tersedia.', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', row.mime || 'image/jpeg');
  headers.set('Cache-Control', 'private, max-age=86400');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(base64ToBytes(payload), { headers });
};
