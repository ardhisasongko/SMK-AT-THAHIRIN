import type { AuthUser } from '../../../_lib/auth';
import { ensureLegacyForumMigrated } from '../../../_lib/forum-notifications';
import { jsonResponse } from '../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

async function mapTopics(db: D1Database, user: AuthUser): Promise<any[]> {
  const { results } = await db.prepare("SELECT * FROM forum_topics WHERE deleted_at IS NULL ORDER BY is_pinned DESC,created_at DESC").all();
  let className = '';
  if ((user.role === 'siswa' || user.role === 'ketua_kelas') && user.classId) {
    const row = await db.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first<{ value: string }>();
    try { className = (JSON.parse(row?.value || '[]') as any[]).find(item => item.id === user.classId)?.name || ''; } catch { className = ''; }
  }
  const output = [];
  for (const row of results as any[]) {
    if ((user.role === 'siswa' || user.role === 'ketua_kelas') && row.category_type === 'kelas' && row.category_name !== className && row.category_name !== user.classId) continue;
    const replies = await db.prepare("SELECT * FROM forum_replies WHERE topic_id=? AND deleted_at IS NULL ORDER BY created_at").bind(row.id).all<any>();
    const likes = await db.prepare('SELECT user_id FROM forum_topic_likes WHERE topic_id=?').bind(row.id).all<any>();
    output.push({ id: row.id, title: row.title, categoryType: row.category_type, categoryName: row.category_name, authorId: row.author_user_id, authorName: row.author_name, authorRole: row.author_role, authorAvatar: row.author_avatar, createdAt: row.created_at, content: row.content, attachments: JSON.parse(row.attachments_json || '[]'), tags: JSON.parse(row.tags_json || '[]'), likes: Number(row.legacy_like_count) + likes.results.length, likedBy: likes.results.map(item => item.user_id), views: Number(row.view_count), isPinned: Boolean(row.is_pinned), isResolved: Boolean(row.is_resolved), replies: replies.results.map((reply: any) => ({ id: reply.id, authorId: reply.author_user_id, authorName: reply.author_name, authorRole: reply.author_role, authorAvatar: reply.author_avatar, createdAt: reply.created_at, content: reply.content, attachments: JSON.parse(reply.attachments_json || '[]'), likes: Number(reply.legacy_like_count), likedBy: [] })) });
  }
  return output;
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  await ensureLegacyForumMigrated(env.DB);
  return jsonResponse({ success: true, data: await mapTopics(env.DB, data.user) });
};

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  await ensureLegacyForumMigrated(env.DB);
  let body: any; try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200 || typeof body.content !== 'string' || !body.content.trim() || body.content.length > 10000 || !['mapel','kelas'].includes(body.categoryType) || typeof body.categoryName !== 'string' || body.categoryName.length > 100) return jsonResponse({ success: false, error: 'Data topik tidak valid.' }, 400);
  if (body.categoryType === 'kelas' && (data.user.role === 'siswa' || data.user.role === 'ketua_kelas')) {
    const classesRow = await env.DB.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first<{ value: string }>();
    const ownClass = JSON.parse(classesRow?.value || '[]').find((item: any) => item.id === data.user!.classId);
    if (!ownClass || ![ownClass.id, ownClass.name].includes(body.categoryName)) return jsonResponse({ success: false, error: 'Tidak dapat membuat topik untuk kelas lain.' }, 403);
  }
  const id = `ft-${crypto.randomUUID()}`; const notificationId = `n-${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO forum_topics (id,title,category_type,category_name,author_user_id,author_name,author_role,author_avatar,content,tags_json,attachments_json,view_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`).bind(id, body.title.trim(), body.categoryType, body.categoryName, data.user.id, data.user.name, data.user.role, '', body.content.trim(), JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0,10).map(String).map((tag: string) => tag.slice(0,30)) : []), '[]'),
    env.DB.prepare('INSERT INTO forum_topic_likes (topic_id,user_id) VALUES (?,?)').bind(id, data.user.id),
    env.DB.prepare(`INSERT INTO notifications (id,title,message,target_role,category,sender_user_id,sender_name,sender_role,action_url,source_kind,source_id) VALUES (?,?,?,'semua','Forum',?,?,?,'forum','forum_topic',?)`).bind(notificationId, `Diskusi Baru: ${body.title.trim().slice(0,100)}`, `${data.user.name} mempublikasikan topik diskusi baru.`, data.user.id, data.user.name, data.user.role, id),
  ]);
  return jsonResponse({ success: true, data: (await mapTopics(env.DB, data.user)).find(item => item.id === id) }, 201);
};
