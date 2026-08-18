export function normalizeIndonesianPhone(value: string): string | null {
  let phone = value.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
  else if (phone.startsWith('8')) phone = `62${phone}`;
  if (!/^628\d{8,11}$/.test(phone)) return null;
  return phone;
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.length < 8 ? '****' : `${phone.slice(0, 5)}****${phone.slice(-3)}`;
}

export function wibDateParts(date = new Date()): { date: string; time: string; dayLabel: string; dateLabel: string } {
  const shifted = new Date(date.getTime() + 7 * 3600 * 1000);
  const dateIso = shifted.toISOString().slice(0, 10);
  const time = shifted.toISOString().slice(11, 16);
  const local = new Date(`${dateIso}T00:00:00Z`);
  return {
    date: dateIso,
    time,
    dayLabel: local.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'UTC' }),
    dateLabel: local.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

export function attendanceMessage(input: { studentName: string; className: string; status: string; date: string; time: string; note?: string }, schoolName = 'SMK PLUS AT-THAHIRIN'): string {
  const local = new Date(`${input.date}T00:00:00Z`);
  const day = local.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'UTC' });
  const dateLabel = local.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const correction = input.note ? `\nKeterangan: ${input.note}` : '';
  return `Yth. Bapak/Ibu Orang Tua/Wali ${input.studentName},\n\n${input.studentName} tercatat *${input.status.toUpperCase()}* di ${schoolName}.\n\nHari/Tanggal: ${day}, ${dateLabel}\nWaktu: ${input.time || '-'} WIB\nKelas: ${input.className}${correction}\n\nPesan otomatis sistem sekolah.`;
}

export function messageFingerprint(input: { text: string; eventIdentity?: string }): string {
  const source = input.eventIdentity || input.text;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function messageEventGroup(dedupeKey: string): string {
  const attendance = dedupeKey.match(/^(attendance:[^:]+:[^:]+):[^:]+(:g[12])$/);
  return attendance ? `${attendance[1]}${attendance[2]}` : dedupeKey;
}

export async function enqueueMessage(db: D1Database, input: { dedupeKey: string; phone: string; type: string; text: string; eventIdentity?: string; studentId?: string; teacherId?: string; attendanceDate?: string; scheduledAt: string }): Promise<boolean> {
  const group = messageEventGroup(input.dedupeKey);
  const fingerprint = messageFingerprint(input);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO whatsapp_event_revisions (event_group,last_fingerprint,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(event_group) DO UPDATE SET revision=revision+1,last_fingerprint=excluded.last_fingerprint,updated_at=excluded.updated_at WHERE last_fingerprint<>excluded.last_fingerprint`).bind(group,fingerprint,now).run();
  const event: any = await db.prepare('SELECT revision FROM whatsapp_event_revisions WHERE event_group=?').bind(group).first();
  const dedupeKey = `${group}:rev-${Number(event?.revision)||1}:${fingerprint}`;
  const result = await db.prepare(
    `INSERT OR IGNORE INTO whatsapp_outbox
      (id, dedupe_key, recipient_phone, message_type, message_text, student_id, teacher_user_id, attendance_date, scheduled_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(`wa-${crypto.randomUUID()}`, dedupeKey, input.phone, input.type, input.text, input.studentId || null, input.teacherId || null, input.attendanceDate || null, input.scheduledAt, now).run();
  const inserted = Number(result.meta?.changes || 0) > 0;
  const date = input.scheduledAt.slice(0, 10);
  const column = inserted ? 'queued' : 'skipped';
  await db.prepare(`INSERT INTO whatsapp_daily_stats (stat_date, ${column}) VALUES (?, 1) ON CONFLICT(stat_date) DO UPDATE SET ${column} = ${column} + 1`).bind(date).run();
  return inserted;
}
