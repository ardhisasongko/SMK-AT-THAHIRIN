// Middleware global Pages Functions.
// Memasang user autentikasi ke context.data.user bila token Bearer valid.
// Endpoint yang butuh auth menolak bila user null.

import { getUserFromRequest, type AuthUser } from './_lib/auth';
import { jsonResponse } from './_lib/response';
import { consumeRateLimit } from './_lib/rate-limit';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

async function bodyExceedsLimit(request: Request, limit: number): Promise<boolean> {
  if (!request.body) return false;
  const reader = request.clone().body!.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return false;
    total += value.byteLength;
    if (total > limit) {
      void reader.cancel().catch(() => undefined);
      return true;
    }
  }
}

export const onRequest: PagesFunction<Env, any, AuthData> = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const method = context.request.method.toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const hasCookieSession = /(?:^|;\s*)smk_session=/.test(context.request.headers.get('Cookie') || '');
  const hasBearer = (context.request.headers.get('Authorization') || '').startsWith('Bearer ');

  if (path.startsWith('/api/') && isMutation && hasCookieSession && !hasBearer) {
    const origin = context.request.headers.get('Origin');
    if (origin !== url.origin) {
      return jsonResponse({ success: false, error: 'Origin permintaan tidak valid.' }, 403);
    }
  }

  const declaredLength = Number(context.request.headers.get('Content-Length') || 0);
  const maxDeclaredLength = path === '/api/upload'
    ? 2 * 1024 * 1024
    : path === '/api/data/presensi_v1'
      ? 5 * 1024 * 1024
      : path.startsWith('/api/data/')
        ? 2 * 1024 * 1024
        : path.startsWith('/api/cbt/exams')
          ? 512 * 1024
          : 128 * 1024;
  if (path.startsWith('/api/') && declaredLength > maxDeclaredLength) {
    return jsonResponse({ success: false, error: 'Ukuran permintaan terlalu besar.' }, 413);
  }
  if (path.startsWith('/api/') && isMutation && await bodyExceedsLimit(context.request, maxDeclaredLength)) {
    return jsonResponse({ success: false, error: 'Ukuran permintaan terlalu besar.' }, 413);
  }

  const user = await getUserFromRequest(context.env, context.request);
  context.data.user = user;
  if (path.startsWith('/api/') && isMutation && path !== '/api/auth/login') {
    const clientIp = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    const actor = user?.id || clientIp;
    if (!(await consumeRateLimit(context.env.DB, `mutation:${actor}`, 120, 60))) {
      return jsonResponse({ success: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }, 429);
    }
  }
  const passwordChangeAllowed = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/me'].includes(path);
  if (user?.mustChangePassword && path.startsWith('/api/') && !passwordChangeAllowed) {
    return jsonResponse({ success: false, error: 'Ganti password awal sebelum menggunakan aplikasi.' }, 403);
  }
  return context.next();
};
