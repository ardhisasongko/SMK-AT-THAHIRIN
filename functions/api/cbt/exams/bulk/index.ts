import type { AuthUser } from '../../../../_lib/auth';
import { hashCbtToken, isCbtStaff, todayWIB } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';
import { validClassTarget } from '../index';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

const WEEKDAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function addMinutesToTime(openTime: string, offsetMinutes: number): string {
  return toTime(toMinutes(openTime) + offsetMinutes);
}

// 5 hari kerja (Senin-Jumat) mulai dari startDate; weekend dilewati.
export function weekdaysFrom(startDate: string, count = 5): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function dayNameOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return WEEKDAY_NAMES[day - 1] ?? DAY_NAMES[day];
}

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang membuat jadwal ujian.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 200) return jsonResponse({ success: false, error: 'Nama periode wajib diisi dan maksimal 200 karakter.' }, 400);
  if (typeof body?.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) return jsonResponse({ success: false, error: 'Tanggal mulai tidak valid.' }, 400);
  if (!Array.isArray(body?.subjects) || body.subjects.length < 1 || body.subjects.length > 8) return jsonResponse({ success: false, error: 'Daftar mapel harus 1-8.' }, 400);
  for (const subject of body.subjects) {
    if (typeof subject?.name !== 'string' || !subject.name.trim() || subject.name.trim().length > 150) return jsonResponse({ success: false, error: 'Setiap mapel wajib punya nama maksimal 150 karakter.' }, 400);
    if (subject?.teacher !== undefined && subject?.teacher !== null && (typeof subject.teacher !== 'string' || subject.teacher.trim().length > 100)) return jsonResponse({ success: false, error: 'Nama pengampu maksimal 100 karakter.' }, 400);
  }
  if (!Number.isInteger(body?.durationMinutes) || body.durationMinutes < 1 || body.durationMinutes > 300) return jsonResponse({ success: false, error: 'Durasi sesi harus 1-300 menit.' }, 400);
  if (typeof body?.openTime !== 'string' || !TIME_PATTERN.test(body.openTime)) return jsonResponse({ success: false, error: 'Jam mulai sesi 1 harus berformat HH:MM.' }, 400);
  if (!Number.isInteger(body?.sessionGapMinutes) || body.sessionGapMinutes < 0 || body.sessionGapMinutes > 180) return jsonResponse({ success: false, error: 'Jeda antar sesi harus 0-180 menit.' }, 400);
  if (!(await validClassTarget(env.DB, body?.classTarget))) return jsonResponse({ success: false, error: 'Target kelas tidak ditemukan.' }, 400);

  const subjects: Array<{ name: string; teacher: string }> = body.subjects.map((subject: any) => ({
    name: String(subject.name).trim(),
    teacher: subject?.teacher ? String(subject.teacher).trim() : '',
  }));
  const dates = weekdaysFrom(body.startDate, 5);
  const minSubmit = Math.round(body.durationMinutes * 0.8);
  const today = todayWIB();
  const statements: D1PreparedStatement[] = [];
  const created: Array<{ id: string; date: string; day: string; subject: string; openTime: string; closeTime: string; token: string; startDate: string }> = [];

  for (const date of dates) {
    for (const subject of subjects) {
      const sessionIndex = subjects.indexOf(subject);
      const openMinutes = toMinutes(body.openTime) + sessionIndex * (body.durationMinutes + body.sessionGapMinutes);
      const closeMinutes = openMinutes + body.durationMinutes;
      const id = `cbt-${crypto.randomUUID()}`;
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
      const status = date > today ? 'upcoming' : 'active';
      statements.push(env.DB.prepare(`INSERT INTO cbt_exams
        (id,title,subject,class_target,duration_minutes,token_hash,teacher_user_id,teacher_name,start_date,end_date,open_time,close_time,status,exam_type,min_submit_minutes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id, `${title} — ${subject.name}`, subject.name, String(body.classTarget), body.durationMinutes,
        await hashCbtToken(token), data.user.id, subject.teacher || data.user.name,
        date, date, toTime(openMinutes), toTime(closeMinutes), status, 'ujian', minSubmit,
      ));
      created.push({ id, date, day: dayNameOf(date), subject: subject.name, openTime: toTime(openMinutes), closeTime: toTime(closeMinutes), token, startDate: date });
    }
  }

  await env.DB.batch(statements);
  return jsonResponse({ success: true, data: { title, exams: created } }, 201);
};