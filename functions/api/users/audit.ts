import type { AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user || !['super_admin', 'admin'].includes(data.user.role)) return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  const { results } = await env.DB.prepare(
    `SELECT id, actor_name, actor_role, action, target_user_id, target_name, reason, created_at
     FROM user_audit_log ORDER BY created_at DESC LIMIT 300`
  ).all();
  return jsonResponse({ success: true, data: results });
};
