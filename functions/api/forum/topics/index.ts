import type { AuthUser } from '../../../_lib/auth';
import { jsonResponse } from '../../../_lib/response';
import { consumeRateLimit } from '../../../_lib/rate-limit';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

async function mapTopics(db: D1Database, user: AuthUser): Promise<any[]> {
  const { results } = await db.prepare("SELECT * FROM forum_topics WHERE deleted_at IS NULL ORDER BY is_pinned DESC,created_at DESC").all();
  let className = '';
  if ((user.role === 'siswa' || user.role === 'ketua_kelas') && user.classId) {
    const row = await db.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first<{ value: string }>();
    try { className = (JSON.parse(row?.value || '[]') as any[]).find(item => item.id === user.classId)?.name || ''; } catch { className = ''; }
  }
  // Filter visibilitas dulu agar balasan/like hanya dimuat untuk topik terlihat.
  const visible = (results as any[]).filter(row => {
    if ((user.role === 'siswa' || user.role === 'ketua_kelas') && row.category_type === 'kelas') {
      return row.class_id ? row.class_id === user.classId : row.category_name === className || row.category_name === user.classId;
    }
    return true;
  });
  if (!visible.length) return [];

  // Anti N+1: seluruh balasan & like dimuat dalam 2 query (IN), lalu dikelompokkan.
  const ids = visible.map(row => String(row.id));
  const placeholders = ids.map(() => '?').join(',');
  const [replyRows, likeRows] = await Promise.all([
    db.prepare(`SELECT * FROM forum_replies WHERE deleted_at IS NULL AND topic_id IN (${placeholders}) ORDER BY created_at`).bind(...ids).all<any>(),
    db.prepare(`SELECT topic_id, user_id FROM forum_topic_likes WHERE topic_id IN (${placeholders})`).bind(...ids).all<any>(),
  ]);

  const repliesByTopic = new Map<string, any[]>();
  for (const reply of replyRows.results) {
    const list = repliesByTopic.get(reply.topic_id) || [];
    list.push({ id: reply.id, authorId: reply.author_user_id, authorName: reply.author_name, authorRole: reply.author_role, authorAvatar: reply.author_avatar, createdAt: reply.created_at, content: reply.content, attachments: JSON.parse(reply.attachments_json || '[]'), likes: Number(reply.legacy_like_count), likedBy: [] });
    repliesByTopic.set(reply.topic_id, list);
  }
  const likesByTopic = new Map<string, string[]>();
  for (const like of likeRows.results) {
    const list = likesByTopic.get(like.topic_id) || [];
    list.push(String(like.user_id));
    likesByTopic.set(like.topic_id, list);
  }

  return visible.map(row => ({ id: row.id, title: row.title, categoryType: row.category_type, categoryName: row.category_name, authorId: row.author_user_id, authorName: row.author_name, authorRole: row.author_role, authorAvatar: row.author_avatar, createdAt: row.created_at, content: row.content, attachments: JSON.parse(row.attachments_json || '[]'), tags: JSON.parse(row.tags_json || '[]'), likes: Number(row.legacy_like_count) + (likesByTopic.get(String(row.id))?.length || 0), likedBy: likesByTopic.get(String(row.id)) || [], views: Number(row.view_count), isPinned: Boolean(row.is_pinned), isResolved: Boolean(row.is_resolved), replies: repliesByTopic.get(String(row.id)) || [] }));
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  return jsonResponse({ success: true, data: await mapTopics(env.DB, data.user) });
};

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!(await consumeRateLimit(env.DB, `forum-topic:${data.user.id}`, 5, 60 * 60))) return jsonResponse({ success: false, error: 'Batas pembuatan topik per jam tercapai.' }, 429);
  let body: any; try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200 || typeof body.content !== 'string' || !body.content.trim() || body.content.length > 10000 || !['mapel','kelas'].includes(body.categoryType) || typeof body.categoryName !== 'string' || body.categoryName.length > 100) return jsonResponse({ success: false, error: 'Data topik tidak valid.' }, 400);
  let targetClass: any = null;
  if (body.categoryType === 'kelas') {
    const classesRow = await env.DB.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first<{ value: string }>();
    let classes: any[] = []; try { classes = JSON.parse(classesRow?.value || '[]'); } catch { classes = []; }
    targetClass = classes.find(item => item.id === body.categoryName || item.name === body.categoryName);
    if (!targetClass) return jsonResponse({ success: false, error: 'Kelas forum tidak ditemukan.' }, 400);
    if ((data.user.role === 'siswa' || data.user.role === 'ketua_kelas') && targetClass.id !== data.user.classId) return jsonResponse({ success: false, error: 'Tidak dapat membuat topik untuk kelas lain.' }, 403);
  }
  const id = `ft-${crypto.randomUUID()}`; const notificationId = `n-${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO forum_topics (id,title,category_type,category_name,class_id,author_user_id,author_name,author_role,author_avatar,content,tags_json,attachments_json,view_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`).bind(id, body.title.trim(), body.categoryType, targetClass?.name || body.categoryName, targetClass?.id || null, data.user.id, data.user.name, data.user.role, '', body.content.trim(), JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0,10).map(String).map((tag: string) => tag.slice(0,30)) : []), '[]'),
    env.DB.prepare('INSERT INTO forum_topic_likes (topic_id,user_id) VALUES (?,?)').bind(id, data.user.id),
    env.DB.prepare(`INSERT INTO notifications (id,title,message,target_role,target_class_id,category,sender_user_id,sender_name,sender_role,action_url,source_kind,source_id) VALUES (?,?,?,?,?,'Forum',?,?,?,'forum','forum_topic',?)`).bind(notificationId, `Diskusi Baru: ${body.title.trim().slice(0,100)}`, `${data.user.name} mempublikasikan topik diskusi baru.`, targetClass ? 'siswa' : 'semua', targetClass?.id || null, data.user.id, data.user.name, data.user.role, id),
    env.DB.prepare('INSERT INTO notification_reads (notification_id,user_id) VALUES (?,?)').bind(notificationId, data.user.id),
  ]);
  return jsonResponse({ success: true, data: (await mapTopics(env.DB, data.user)).find(item => item.id === id) }, 201);
};
