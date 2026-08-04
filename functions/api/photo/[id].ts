// Menyajikan foto presensi dari D1 (base64). Butuh login (token Bearer).
// GET /api/photo/:id

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

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, params, data }) => {
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

  const row = await env.DB
    .prepare('SELECT data, mime FROM photos WHERE id = ?')
    .bind(String(id))
    .first<{ data: string; mime: string }>();

  if (!row) {
    return new Response('Foto tidak ditemukan.', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', row.mime || 'image/jpeg');
  headers.set('Cache-Control', 'private, max-age=86400');
  return new Response(base64ToBytes(row.data), { headers });
};