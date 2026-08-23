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

