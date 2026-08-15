import type { AuthUser } from './auth';
import { parseJson } from './cbt';

export const NOTIFICATION_ROLES = new Set(['semua', 'guru', 'siswa', 'admin']);
export const NOTIFICATION_CATEGORIES = new Set(['Ujian', 'Tugas', 'Absensi', 'Forum', 'Pengumuman', 'Sistem']);
export const ACTION_URLS = new Set(['landing', 'cbt', 'absensi', 'kelas', 'modul-ajar', 'forum', 'notifikasi', 'profil']);

export function notificationVisible(user: AuthUser, row: any): boolean {
  if (user.role === 'admin' || user.role === 'super_admin' || row.sender_user_id === user.id) return true;
  if (row.category === 'Forum' && row.target_class_id && user.role === 'guru') return true;
  const roleMatches = row.target_role === 'semua'
    || (row.target_role === 'siswa' && (user.role === 'siswa' || user.role === 'ketua_kelas'))
    || row.target_role === user.role;
  return roleMatches && (!row.target_class_id || row.target_class_id === user.classId);
}

export async function forumTopicVisible(db: D1Database, user: AuthUser, row: any): Promise<boolean> {
  if (row.category_type !== 'kelas' || !['siswa', 'ketua_kelas'].includes(user.role)) return true;
  if (!user.classId) return false;
  if (row.class_id) return row.class_id === user.classId;
  if (row.category_name === user.classId) return true;
  const classesRow = await db.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first<{ value: string }>();
  const classes = parseJson<any[]>(classesRow?.value, []);
  return classes.some(item => item.id === user.classId && item.name === row.category_name);
}

export async function ensureLegacyForumMigrated(db: D1Database): Promise<void> {
  const migrationKey = 'legacy_forum_v1';
  const migrated = await db.prepare('SELECT key FROM domain_migrations WHERE key=?').bind(migrationKey).first();
  if (migrated) return;
  const row = await db.prepare("SELECT value FROM app_data WHERE key='forumTopics_v1'").first<{ value: string }>();
  const topics = parseJson<any[]>(row?.value, []);
  const classesRow = await db.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first<{ value: string }>();
  const classes = parseJson<any[]>(classesRow?.value, []);
  for (const topic of topics) {
    if (!topic?.id || !topic?.title) continue;
    const likedBy = [...new Set(Array.isArray(topic.likedBy) ? topic.likedBy.map(String) : [])];
    const classId = topic.categoryType === 'kelas'
      ? classes.find(item => item?.id === topic.categoryName || item?.name === topic.categoryName)?.id || null
      : null;
    const statements = [
      db.prepare(`INSERT OR IGNORE INTO forum_topics (id,title,category_type,category_name,class_id,author_user_id,author_name,author_role,author_avatar,content,tags_json,attachments_json,legacy_like_count,view_count,is_pinned,is_resolved,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(String(topic.id), String(topic.title).slice(0,200), topic.categoryType === 'kelas' ? 'kelas' : 'mapel', String(topic.categoryName || '').slice(0,100), classId, String(topic.authorId || 'legacy'), String(topic.authorName || 'Pengguna'), String(topic.authorRole || 'siswa'), String(topic.authorAvatar || ''), String(topic.content || '').slice(0,10000), JSON.stringify(topic.tags || []), JSON.stringify(topic.attachments || []), Math.max(0, Number(topic.likes || 0) - likedBy.length), Math.max(0, Number(topic.views || 0)), topic.isPinned ? 1 : 0, topic.isResolved ? 1 : 0, new Date().toISOString()),
      ...likedBy.map(userId => db.prepare('INSERT OR IGNORE INTO forum_topic_likes (topic_id,user_id) VALUES (?,?)').bind(String(topic.id), userId)),
      ...(Array.isArray(topic.replies) ? topic.replies.map((reply: any) => db.prepare(`INSERT OR IGNORE INTO forum_replies (id,topic_id,author_user_id,author_name,author_role,author_avatar,content,attachments_json,legacy_like_count,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(String(reply.id), String(topic.id), String(reply.authorId || 'legacy'), String(reply.authorName || 'Pengguna'), String(reply.authorRole || 'siswa'), String(reply.authorAvatar || ''), String(reply.content || '').slice(0,10000), JSON.stringify(reply.attachments || []), Math.max(0, Number(reply.likes || 0)), new Date().toISOString())) : []),
    ];
    await db.batch(statements);
  }
  await db.prepare('INSERT OR IGNORE INTO domain_migrations (key) VALUES (?)').bind(migrationKey).run();
}

export async function ensureLegacyNotificationsMigrated(db: D1Database): Promise<void> {
  const migrationKey = 'legacy_notifications_v1';
  const migrated = await db.prepare('SELECT key FROM domain_migrations WHERE key=?').bind(migrationKey).first();
  if (migrated) return;
  const row = await db.prepare("SELECT value FROM app_data WHERE key='notifications_v1'").first<{ value: string }>();
  const notifications = parseJson<any[]>(row?.value, []);
  for (const item of notifications) {
    if (!item?.id || !item?.title || !NOTIFICATION_ROLES.has(item.targetRole) || !NOTIFICATION_CATEGORIES.has(item.category)) continue;
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO notifications (id,title,message,target_role,target_class_id,category,sender_name,sender_role,action_url,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(String(item.id), String(item.title).slice(0,200), String(item.message || '').slice(0,5000), item.targetRole, item.targetClassId || null, item.category, item.senderName || null, item.senderRole || null, ACTION_URLS.has(item.actionUrl) ? item.actionUrl : null, new Date().toISOString()),
      ...(Array.isArray(item.isReadBy) ? item.isReadBy.map((userId: unknown) => db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id,user_id) VALUES (?,?)').bind(String(item.id), String(userId))) : []),
    ]);
  }
  await db.prepare('INSERT OR IGNORE INTO domain_migrations (key) VALUES (?)').bind(migrationKey).run();
}
