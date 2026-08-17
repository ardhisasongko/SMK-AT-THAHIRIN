import { describe, expect, it, vi } from 'vitest';
import { addMinutesToTime, dayNameOf, onRequestPost, weekdaysFrom } from '../functions/api/cbt/exams/bulk/index';
import type { AuthUser } from '../functions/_lib/auth';

const teacher = {
  id: 'guru-1', name: 'Guru Satu', role: 'guru', email: '', nipNisn: null, nik: null,
  tanggalLahir: null, classId: null, ketuaStatus: 'none', jabatan: null, status: 'active', mustChangePassword: false,
} as AuthUser;
const student = { ...teacher, id: 'siswa-1', name: 'Siswa Satu', role: 'siswa', classId: 'k1' } as AuthUser;

const payload = {
  title: 'PTS Ganjil 2026/2027',
  startDate: '2026-09-14', // Senin
  subjects: [
    { name: 'Kearsipan', teacher: 'Bpk. Guru' },
    { name: 'OTK', teacher: 'Ibu Guru' },
    { name: 'KKPL', teacher: '' },
    { name: 'Bahasa Indonesia', teacher: 'Bpk. Sastra' },
  ],
  classTarget: 'Semua Kelas MPLB',
  durationMinutes: 90,
  openTime: '07:30',
  sessionGapMinutes: 15,
};

function dbWith(className: string | null = 'X MPLB 1') {
  const batch = vi.fn(async () => []);
  const first = vi.fn(async () => (className ? { value: JSON.stringify([{ id: 'k1', name: 'X MPLB 1' }]) } : null));
  const prepare = vi.fn(() => ({
    bind: vi.fn(() => ({ first })),
    first,
  }));
  return { prepare, batch } as any;
}

function request(body: object) {
  return new Request('http://test/api/cbt/exams/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('PTS/UAS bulk schedule API', () => {
  it('menghitung 5 hari kerja Senin-Jumat melewati weekend', () => {
    const dates = weekdaysFrom('2026-09-14'); // Senin
    expect(dates).toHaveLength(5);
    expect(dates[0]).toBe('2026-09-14');
    expect(dates[4]).toBe('2026-09-18');
    const fromSaturday = weekdaysFrom('2026-09-12'); // Sabtu -> mulai Senin 14
    expect(fromSaturday[0]).toBe('2026-09-14');
    expect(dayNameOf('2026-09-16')).toBe('Rabu');
  });

  it('menghitung jam sesi beruntun dengan jeda', () => {
    expect(addMinutesToTime('07:30', 0)).toBe('07:30');
    expect(addMinutesToTime('07:30', 90)).toBe('09:00');
    expect(addMinutesToTime('07:30', 105)).toBe('09:15');
  });

  it('menolak siswa', async () => {
    const response = await onRequestPost({ env: { DB: dbWith() }, data: { user: student }, request: request(payload) } as any);
    expect(response.status).toBe(403);
  });

  it('membuat 20 ujian (5 hari x 4 mapel) dengan token otomatis', async () => {
    const db = dbWith();
    const response = await onRequestPost({ env: { DB: db }, data: { user: teacher }, request: request(payload) } as any);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.exams).toHaveLength(20);
    expect(db.batch).toHaveBeenCalledTimes(1);
    const statements = db.batch.mock.calls[0][0];
    expect(statements).toHaveLength(20);
    expect(db.prepare).toHaveBeenCalledTimes(20);
    const tokens = new Set(body.data.exams.map((exam: { token: string }) => exam.token));
    expect(tokens.size).toBe(20);
    const kearsipanSenin = body.data.exams.find((exam: { day: string; subject: string }) => exam.day === 'Senin' && exam.subject === 'Kearsipan');
    expect(kearsipanSenin).toMatchObject({ openTime: '07:30', closeTime: '09:00' });
    const otkSenin = body.data.exams.find((exam: { day: string; subject: string }) => exam.day === 'Senin' && exam.subject === 'OTK');
    expect(otkSenin).toMatchObject({ openTime: '09:15', closeTime: '10:45' });
    const indonesiaJumat = body.data.exams.find((exam: { day: string; subject: string }) => exam.day === 'Jumat' && exam.subject === 'Bahasa Indonesia');
    expect(indonesiaJumat).toMatchObject({ openTime: '12:45', closeTime: '14:15' });
  });

  it('menolak mapel kosong atau lebih dari 8', async () => {
    const badSubjects = { ...payload, subjects: [{ name: '' }] };
    const response = await onRequestPost({ env: { DB: dbWith() }, data: { user: teacher }, request: request(badSubjects) } as any);
    expect(response.status).toBe(400);
    const tooMany = { ...payload, subjects: Array.from({ length: 9 }, (_, i) => ({ name: `Mapel ${i}` })) };
    const response2 = await onRequestPost({ env: { DB: dbWith() }, data: { user: teacher }, request: request(tooMany) } as any);
    expect(response2.status).toBe(400);
  });

  it('menolak kelas target tidak ditemukan', async () => {
    const response = await onRequestPost({ env: { DB: dbWith(null) }, data: { user: teacher }, request: request({ ...payload, classTarget: 'k99' }) } as any);
    expect(response.status).toBe(400);
  });
});