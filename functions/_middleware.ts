// Middleware global Pages Functions.
// Memasang user autentikasi ke context.data.user bila token Bearer valid.
// Endpoint yang butuh auth menolak bila user null.

import { getUserFromRequest, type AuthUser } from './_lib/auth';
import { jsonResponse } from './_lib/response';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequest: PagesFunction<Env, any, AuthData> = async (context) => {
  const user = await getUserFromRequest(context.env, context.request);
  context.data.user = user;
  const path = new URL(context.request.url).pathname;
  const passwordChangeAllowed = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/me'].includes(path);
  if (user?.mustChangePassword && path.startsWith('/api/') && !passwordChangeAllowed) {
    return jsonResponse({ success: false, error: 'Ganti password awal sebelum menggunakan aplikasi.' }, 403);
  }
  return context.next();
};
