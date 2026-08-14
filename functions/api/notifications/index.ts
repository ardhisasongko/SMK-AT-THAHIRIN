import type { AuthUser } from '../../_lib/auth';
import { ACTION_URLS, ensureLegacyNotificationsMigrated, NOTIFICATION_CATEGORIES, NOTIFICATION_ROLES, notificationVisible } from '../../_lib/forum-notifications';
import { jsonResponse } from '../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

async function listNotifications(db: D1Database, user: AuthUser): Promise<any[]> {
  const { results } = await db.prepare("SELECT * FROM notifications WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500").all();
  const visible = (results as any[]).filter(row => notificationVisible(user, row));
  const output = [];
  for (const row of visible) {
    const reads = await db.prepare('SELECT user_id FROM notification_reads WHERE notification_id=?').bind(row.id).all<any>();
    output.push({ id: row.id, title: row.title, message: row.message, targetRole: row.target_role, targetClassId: row.target_class_id || undefined, category: row.category, createdAt: row.created_at, isReadBy: reads.results.map(item => item.user_id), actionUrl: row.action_url || undefined, senderName: row.sender_name || undefined, senderRole: row.sender_role || undefined, isEmailSent: false });
  }
  return output;
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  await ensureLegacyNotificationsMigrated(env.DB);
  return jsonResponse({ success: true, data: await listNotifications(env.DB, data.user) });
};

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!['guru','admin','super_admin'].includes(data.user.role)) return jsonResponse({ success: false, error: 'Tidak berwenang mengirim notifikasi.' }, 403);
  await ensureLegacyNotificationsMigrated(env.DB);
  let body: any; try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200 || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 5000 || !NOTIFICATION_ROLES.has(body.targetRole) || !NOTIFICATION_CATEGORIES.has(body.category)) return jsonResponse({ success: false, error: 'Data notifikasi tidak valid.' }, 400);
  if (data.user.role === 'guru' && (body.targetRole === 'admin' || body.category === 'Sistem')) return jsonResponse({ success: false, error: 'Guru tidak dapat mengirim notifikasi sistem/admin.' }, 403);
  const id = `n-${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO notifications (id,title,message,target_role,target_class_id,category,sender_user_id,sender_name,sender_role,action_url) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, body.title.trim(), body.message.trim(), body.targetRole, body.targetClassId || null, body.category, data.user.id, data.user.name, data.user.role, ACTION_URLS.has(body.actionUrl) ? body.actionUrl : null),
    env.DB.prepare('INSERT INTO notification_reads (notification_id,user_id) VALUES (?,?)').bind(id, data.user.id),
  ]);
  return jsonResponse({ success: true, data: { id, title: body.title.trim(), message: body.message.trim(), targetRole: body.targetRole, targetClassId: body.targetClassId, category: body.category, createdAt: new Date().toISOString(), isReadBy: [data.user.id], senderName: data.user.name, senderRole: data.user.role, isEmailSent: false } }, 201);
};
