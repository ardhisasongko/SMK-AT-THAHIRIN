import { describe, expect, it, vi } from 'vitest';
import { onRequestGet } from '../functions/api/cbt/analytics/index';
import type { AuthUser } from '../functions/_lib/auth';

const teacher = {
  id: 'guru-1', name: 'Guru Satu', role: 'guru', email: '', nipNisn: null, nik: null,
  tanggalLahir: null, classId: null, ketuaStatus: 'none', jabatan: null, status: 'active', mustChangePassword: false,
} as AuthUser;
const student = { ...teacher, id: 'siswa-1', name: 'Siswa Satu', role: 'siswa', classId: 'k1' } as AuthUser;
const admin = { ...teacher, id: 'admin-1', name: 'Admin Satu', role: 'admin' } as AuthUser;

const rows = [
  { examId: 'e1', title: 'UAS Kearsipan', subject: 'Kearsipan', classTarget: 'X MPLB 1', examType: 'ujian', durationMinutes: 60, attemptId: 'a1', studentName: 'Siti', nisn: '001', score: 100, timeSpentSeconds: 300, submittedAt: '2026-08-16 10:00:00' },
  { examId: 'e1', title: 'UAS Kearsipan', subject: 'Kearsipan', classTarget: 'X MPLB 1', examType: 'ujian', durationMinutes: 60, attemptId: 'a2', studentName: 'Budi', nisn: '002', score: 60, timeSpentSeconds: 3000, submittedAt: '2026-08-16 10:30:00' },
  { examId: 'e2', title: 'Latihan Kearsipan', subject: 'Kearsipan', classTarget: 'X MPLB 1', examType: 'latihan', durationMinutes: 30, attemptId: 'a3', studentName: 'Siti', nisn: '001', score: 50, timeSpentSeconds: 500, submittedAt: '2026-08-16 11:00:00' },
];

function dbWith(rowsFor: 'all' | 'own') {
  const all = vi.fn(async () => ({ results: rowsFor === 'all' ? rows : rows.filter((_, index) => index !== 2) }));
  const prepare = vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn(async () => ({ key: 'legacy_cbt_v1' })),
      all,
    })),
    all,
  }));
  return { prepare, batch: vi.fn(async () => []) } as any;
}

describe('CBT analytics API', () => {
  it('menolak akses siswa', async () => {
    const response = await onRequestGet({ env: { DB: dbWith('own') }, data: { user: student } } as any);
    expect(response.status).toBe(403);
  });

  it('guru hanya melihat ujian miliknya dan menghitung distribusi', async () => {
    const response = await onRequestGet({ env: { DB: dbWith('own') }, data: { user: teacher } } as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.exams).toHaveLength(1);
    const exam = body.data.exams[0];
    expect(exam.examId).toBe('e1');
    expect(exam.studentCount).toBe(2);
    expect(exam.avgScore).toBe(80);
    expect(exam.bestScore).toBe(100);
    expect(exam.worstScore).toBe(60);
    const bucket90 = exam.buckets.find((bucket: { label: string }) => bucket.label === '90–100');
    expect(bucket90.count).toBe(1);
  });

  it('mendeteksi pengerjaan cepat dan flag mencurigakan', async () => {
    const response = await onRequestGet({ env: { DB: dbWith('own') }, data: { user: teacher } } as any);
    const body = await response.json();
    const exam = body.data.exams[0];
    // Durasi 60 mnt -> ambang 15 mnt (900 dtk); Siti 300 dtk + skor 100 -> mencurigakan
    expect(exam.fastAttempts).toHaveLength(1);
    expect(exam.fastAttempts[0]).toMatchObject({ studentName: 'Siti', score: 100, suspicious: true });
  });

  it('admin melihat semua ujian lintas guru', async () => {
    const response = await onRequestGet({ env: { DB: dbWith('all') }, data: { user: admin } } as any);
    const body = await response.json();
    expect(body.data.exams).toHaveLength(2);
    expect(body.data.exams[0].examId).toBe('e2'); // sorted by title
  });
});