// Middleware global Pages Functions.
// Memasang user autentikasi ke context.data.user bila token Bearer valid.
// Endpoint yang butuh auth menolak bila user null.

import { getUserFromRequest, type AuthUser } from './_lib/auth';

interface Env {
  DB: D1Database;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequest: PagesFunction<Env, any, AuthData> = async (context) => {
  const user = await getUserFromRequest(context.env, context.request);
  context.data.user = user;
  return context.next();
};
