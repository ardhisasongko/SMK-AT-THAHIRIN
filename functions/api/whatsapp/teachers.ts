import type { AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { maskPhone, normalizeIndonesianPhone } from '../../_lib/whatsapp';
interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };
const allowed = (u: AuthUser | null) => !!u && ['super_admin', 'admin'].includes(u.role);
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!allowed(data.user)) return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  const { results } = await env.DB.prepare(`SELECT u.id, u.name, u.nip_nisn, w.phone, w.reminder_enabled, w.reminder_time FROM users u LEFT JOIN teacher_whatsapp_settings w ON w.teacher_user_id=u.id WHERE u.role='guru' AND u.status='active' ORDER BY u.name`).all();
  return jsonResponse({ success: true, data: results.map((r: any) => ({ teacherId: r.id, teacherName: r.name, identifier: r.nip_nisn, phone: r.phone || '', masked: maskPhone(r.phone), enabled: Number(r.reminder_enabled || 0) === 1, reminderTime: r.reminder_time || '05:30' })) });
};
export const onRequestPut: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!allowed(data.user)) return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  let b: any; try { b = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const phone = b.phone ? normalizeIndonesianPhone(b.phone) : null;
  if (!b.teacherId || (b.phone && !phone)) return jsonResponse({ success: false, error: 'Guru atau nomor tidak valid.' }, 400);
  const teacher = await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='guru' AND status='active'").bind(b.teacherId).first();
  if (!teacher) return jsonResponse({ success: false, error: 'Guru aktif tidak ditemukan.' }, 404);
  await env.DB.prepare(`INSERT INTO teacher_whatsapp_settings (teacher_user_id, phone, reminder_enabled, reminder_time, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(teacher_user_id) DO UPDATE SET phone=excluded.phone, reminder_enabled=excluded.reminder_enabled, reminder_time=excluded.reminder_time, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .bind(b.teacherId, phone, b.enabled ? 1 : 0, b.reminderTime || '05:30', data.user!.id, new Date().toISOString()).run();
  return jsonResponse({ success: true, data: { masked: maskPhone(phone) } });
};
