import type { AuthUser } from '../../_lib/auth';
import { ACTION_URLS, ensureLegacyNotificationsMigrated, NOTIFICATION_CATEGORIES, NOTIFICATION_ROLES } from '../../_lib/forum-notifications';
import { jsonResponse } from '../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export async function listNotifications(db: D1Database, user: AuthUser): Promise<any[]> {
  const { results } = await db.prepare(`
    SELECT n.*, CASE WHEN own_read.user_id IS NULL THEN 0 ELSE 1 END AS is_read
    FROM notifications n
    LEFT JOIN notification_reads own_read
      ON own_read.notification_id=n.id AND own_read.user_id=?
    WHERE n.deleted_at IS NULL
      AND (
        ? IN ('admin','super_admin')
        OR n.sender_user_id=?
        OR (
          (n.target_role='semua' OR n.target_role=? OR (n.target_role='siswa' AND ?='ketua_kelas') OR (n.category='Forum' AND n.target_class_id IS NOT NULL AND ?='guru'))
          AND (n.target_class_id IS NULL OR n.target_class_id=? OR (n.category='Forum' AND ?='guru'))
        )
      )
    ORDER BY n.created_at DESC
    LIMIT 500
  `).bind(user.id, user.role, user.id, user.role, user.role, user.role, user.classId, user.role).all<any>();
  return results.map(row => ({ id: row.id, title: row.title, message: row.message, targetRole: row.target_role, targetClassId: row.target_class_id || undefined, category: row.category, createdAt: row.created_at, isRead: Boolean(row.is_read), actionUrl: row.action_url || undefined, senderName: row.sender_name || undefined, senderRole: row.sender_role || undefined }));
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
  let targetClassId: string | null = null;
  if (body.targetClassId !== undefined && body.targetClassId !== null && body.targetClassId !== '') {
    if (body.targetRole !== 'siswa' || typeof body.targetClassId !== 'string') return jsonResponse({ success: false, error: 'Target kelas hanya dapat digunakan untuk siswa.' }, 400);
    const classesRow = await env.DB.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first<{ value: string }>();
    let classes: any[] = []; try { classes = JSON.parse(classesRow?.value || '[]'); } catch { classes = []; }
    if (!classes.some(item => item.id === body.targetClassId)) return jsonResponse({ success: false, error: 'Target kelas tidak ditemukan.' }, 400);
    targetClassId = body.targetClassId;
  }
  const id = `n-${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO notifications (id,title,message,target_role,target_class_id,category,sender_user_id,sender_name,sender_role,action_url) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, body.title.trim(), body.message.trim(), body.targetRole, targetClassId, body.category, data.user.id, data.user.name, data.user.role, ACTION_URLS.has(body.actionUrl) ? body.actionUrl : null),
    env.DB.prepare('INSERT INTO notification_reads (notification_id,user_id) VALUES (?,?)').bind(id, data.user.id),
  ]);
  return jsonResponse({ success: true, data: { id, title: body.title.trim(), message: body.message.trim(), targetRole: body.targetRole, targetClassId: targetClassId || undefined, category: body.category, createdAt: new Date().toISOString(), isRead: true, senderName: data.user.name, senderRole: data.user.role } }, 201);
};
