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

export function attendanceMessage(input: { studentName: string; className: string; status: string; date: string; time: string; note?: string }): string {
  const local = new Date(`${input.date}T00:00:00Z`);
  const day = local.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'UTC' });
  const dateLabel = local.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const correction = input.note ? `\nKeterangan: ${input.note}` : '';
  return `Yth. Bapak/Ibu Orang Tua/Wali ${input.studentName},\n\n${input.studentName} tercatat *${input.status.toUpperCase()}* di SMK PLUS AT THAHIRIN.\n\nHari/Tanggal: ${day}, ${dateLabel}\nWaktu: ${input.time || '-'} WIB\nKelas: ${input.className}${correction}\n\nPesan otomatis sistem sekolah.`;
}

export async function enqueueMessage(db: D1Database, input: { dedupeKey: string; phone: string; type: string; text: string; studentId?: string; teacherId?: string; attendanceDate?: string; scheduledAt: string }): Promise<boolean> {
  const result = await db.prepare(
    `INSERT OR IGNORE INTO whatsapp_outbox
      (id, dedupe_key, recipient_phone, message_type, message_text, student_id, teacher_user_id, attendance_date, scheduled_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(`wa-${crypto.randomUUID()}`, input.dedupeKey, input.phone, input.type, input.text, input.studentId || null, input.teacherId || null, input.attendanceDate || null, input.scheduledAt, new Date().toISOString()).run();
  const inserted = Number(result.meta?.changes || 0) > 0;
  const date = input.scheduledAt.slice(0, 10);
  const column = inserted ? 'queued' : 'skipped';
  await db.prepare(`INSERT INTO whatsapp_daily_stats (stat_date, ${column}) VALUES (?, 1) ON CONFLICT(stat_date) DO UPDATE SET ${column} = ${column} + 1`).bind(date).run();
  return inserted;
}
