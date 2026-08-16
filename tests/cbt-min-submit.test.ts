import { describe, expect, it, vi } from 'vitest';
import { resolveMinSubmitSeconds, validateCbtExamInput } from '../functions/_lib/cbt';
import { onRequestPost as submitAttempt } from '../functions/api/cbt/attempts/[id]/submit';
import type { AuthUser } from '../functions/_lib/auth';

const student: AuthUser = {
  id: 'u1', name: 'Siswa', email: 's@example.test', nipNisn: '123', nik: null,
  tanggalLahir: null, role: 'siswa', classId: 'k1', ketuaStatus: 'none', jabatan: null,
  status: 'active', mustChangePassword: false,
};

function submitDb({ attempt, exam }: { attempt: any; exam: any }) {
  const run = vi.fn(async () => ({ success: true }));
  const all = vi.fn(async (sql?: string) => {
    if (sql?.includes('domain_migrations')) return { results: [{ key: 'legacy_cbt_v1' }] };
    return { results: [] };
  });
  const first = vi.fn(async (sql?: string) => {
    if (sql?.includes('domain_migrations')) return { key: 'legacy_cbt_v1' };
    if (sql?.includes('FROM cbt_exams')) return exam;
    return attempt;
  });
  const prepare = vi.fn((sql: string) => {
    const bound = {
      first: () => first(sql),
      all: () => all(sql),
      run,
    };
    return { bind: vi.fn(() => bound), ...bound };
  });
  return { prepare } as any;
}

function submitReq(answers: Record<string, string>) {
  return new Request('http://test/api/cbt/attempts/a1/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, doubtful: {} }) });
}

describe('resolveMinSubmitSeconds', () => {
  it('latihan: bebas kirim (0 detik)', () => {
    expect(resolveMinSubmitSeconds({ exam_type: 'latihan', duration_minutes: 40 })).toBe(0);
    expect(resolveMinSubmitSeconds({})).toBe(0);
  });

  it('ujian: default 80% dari durasi', () => {
    expect(resolveMinSubmitSeconds({ exam_type: 'ujian', duration_minutes: 40 })).toBe(32 * 60);
  });

  it('ujian: memakai nilai eksplisit bila diberikan', () => {
    expect(resolveMinSubmitSeconds({ exam_type: 'ujian', min_submit_minutes: 35, duration_minutes: 40 })).toBe(35 * 60);
  });

  it('ujian: membatasi maksimal ke durasi ujian', () => {
    expect(resolveMinSubmitSeconds({ exam_type: 'ujian', min_submit_minutes: 99, duration_minutes: 40 })).toBe(40 * 60);
  });
});

describe('validateCbtExamInput jenis ujian & waktu minimal', () => {
  const base = {
    title: 'Ujian', subject: 'Kearsipan', durationMinutes: 40, token: 'ABCD', startDate: '2026-08-15', endDate: '2026-08-16',
    questions: [{ id: 'q1', question: 'P?', correctAnswer: 'A', options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Opsi ${key}` })) }],
  };

  it('menerima jenis ujian resmi dengan waktu minimal valid', () => {
    expect(validateCbtExamInput({ ...base, examType: 'ujian', minSubmitMinutes: 35 })).toBeNull();
    expect(validateCbtExamInput({ ...base, examType: 'latihan' })).toBeNull();
    expect(validateCbtExamInput(base)).toBeNull();
  });

  it('menolak jenis ujian tak dikenal dan waktu minimal di luar rentang', () => {
    expect(validateCbtExamInput({ ...base, examType: 'kocak' })).toMatch(/Jenis ujian/);
    expect(validateCbtExamInput({ ...base, examType: 'ujian', minSubmitMinutes: 0 })).toMatch(/Waktu minimal kirim/);
    expect(validateCbtExamInput({ ...base, examType: 'ujian', minSubmitMinutes: 41 })).toMatch(/Waktu minimal kirim/);
    expect(validateCbtExamInput({ ...base, examType: 'ujian', minSubmitMinutes: 30.5 })).toMatch(/Waktu minimal kirim/);
  });
});

describe('CBT submit ujian resmi — waktu minimal (server)', () => {
  const examRow = { exam_type: 'ujian', min_submit_minutes: 30, duration_minutes: 40 };

  it('menolak kirim sebelum waktu minimal (409)', async () => {
    const db = submitDb({
      attempt: { id: 'a1', exam_id: 'e1', status: 'in_progress', started_at: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 600_000).toISOString() },
      exam: examRow,
    });
    const response = await submitAttempt({ env: { DB: db }, data: { user: student }, request: submitReq({ q1: 'A' }), params: { id: 'a1' } } as any);
    expect(response.status).toBe(409);
    const json = await response.json() as any;
    expect(json.error).toMatch(/belum boleh dikirim/);
    expect(json.error).toMatch(/tunggu sekitar 29 menit/);
  });

  it('mengizinkan kirim setelah waktu minimal berlalu', async () => {
    const db = submitDb({
      attempt: { id: 'a1', exam_id: 'e1', status: 'in_progress', started_at: new Date(Date.now() - 31 * 60_000).toISOString(), expires_at: new Date(Date.now() + 600_000).toISOString() },
      exam: examRow,
    });
    const response = await submitAttempt({ env: { DB: db }, data: { user: student }, request: submitReq({}), params: { id: 'a1' } } as any);
    expect(response.status).toBe(200);
  });

  it('ujian latihan tetap bisa dikirim cepat (tanpa blokir)', async () => {
    const db = submitDb({
      attempt: { id: 'a1', exam_id: 'e1', status: 'in_progress', started_at: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 600_000).toISOString() },
      exam: { exam_type: 'latihan', min_submit_minutes: null, duration_minutes: 40 },
    });
    const response = await submitAttempt({ env: { DB: db }, data: { user: student }, request: submitReq({}), params: { id: 'a1' } } as any);
    expect(response.status).toBe(200);
  });
});