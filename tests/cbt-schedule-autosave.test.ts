import { describe, expect, it, vi } from 'vitest';
import { cbtWindowOpen, isValidTime, validateCbtExamInput, timeToMinutes } from '../functions/_lib/cbt';
import { onRequestPost as saveAttempt } from '../functions/api/cbt/attempts/[id]/save';
import { onRequestGet as getSummary } from '../functions/api/cbt/summary/index';
import type { AuthUser } from '../functions/_lib/auth';

const student: AuthUser = {
  id: 'u1', name: 'Siswa', email: 's@example.test', nipNisn: '123', nik: null,
  tanggalLahir: null, role: 'siswa', classId: 'k1', ketuaStatus: 'none', jabatan: null,
  status: 'active', mustChangePassword: false,
};

describe('CBT schedule window', () => {
  it('validates HH:MM time format', () => {
    expect(isValidTime('08:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('8:00')).toBe(false);
    expect(isValidTime('08:60')).toBe(false);
    expect(isValidTime(null)).toBe(false);
    expect(timeToMinutes('08:30')).toBe(510);
  });

  it('allows access inside open/close window', () => {
    expect(cbtWindowOpen({ open_time: '07:00', close_time: '12:00' }, 8 * 60 + 30)).toEqual({ open: true });
  });

  it('rejects access before open and after close', () => {
    expect(cbtWindowOpen({ open_time: '08:00', close_time: '12:00' }, 7 * 60 + 59)).toMatchObject({ open: false, reason: expect.stringContaining('08:00') });
    expect(cbtWindowOpen({ open_time: '08:00', close_time: '12:00' }, 12 * 60)).toMatchObject({ open: false, reason: expect.stringContaining('12:00') });
  });

  it('treats missing times as always open', () => {
    expect(cbtWindowOpen({}, 0)).toEqual({ open: true });
    expect(cbtWindowOpen({ open_time: null, close_time: '' }, 23 * 60 + 59)).toEqual({ open: true });
  });

  it('validates open/close time in exam input', () => {
    const valid = {
      title: 'Ujian', subject: 'Kearsipan', durationMinutes: 30, token: 'ABCD', startDate: '2026-08-15', endDate: '2026-08-16', openTime: '08:00', closeTime: '11:30',
      questions: [{ id: 'q1', question: 'Pertanyaan?', correctAnswer: 'A', options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Opsi ${key}` })) }],
    };
    expect(validateCbtExamInput(valid)).toBeNull();
    expect(validateCbtExamInput({ ...valid, openTime: '8:00' })).toMatch(/HH:MM/);
    expect(validateCbtExamInput({ ...valid, closeTime: '25:00' })).toMatch(/HH:MM/);
    expect(validateCbtExamInput({ ...valid, openTime: '11:00', closeTime: '11:00' })).toMatch(/lebih lambat/);
    expect(validateCbtExamInput({ ...valid, openTime: '12:00', closeTime: '08:00' })).toMatch(/lebih lambat/);
  });
});

describe('CBT attempt auto-save API', () => {
  function saveDb({ attempt = null, questions = [] as any[] } = {}) {
    const run = vi.fn(async () => ({ success: true }));
    const all = vi.fn(async (sql?: string) => {
      if (sql?.includes('domain_migrations')) return { results: [{ key: 'legacy_cbt_v1' }] };
      return { results: questions };
    });
    const first = vi.fn(async (sql?: string) => {
      if (sql?.includes('domain_migrations')) return { key: 'legacy_cbt_v1' };
      if (sql?.includes('cbt_attempt_answers')) return null;
      return attempt;
    });
    const prepare = vi.fn((sql: string) => ({ bind: vi.fn(() => ({ first, all, run })), all, first, run }));
    return { prepare } as any;
  }

  function saveReq(body: object) {
    return new Request('http://test/api/cbt/attempts/a1/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  it('persists valid answers for in-progress attempt', async () => {
    const db = saveDb({
      attempt: { id: 'a1', exam_id: 'e1', status: 'in_progress', expires_at: new Date(Date.now() + 600_000).toISOString() },
      questions: [{ id: 'q1', correctAnswer: 'A' }],
    });
    const response = await saveAttempt({ env: { DB: db }, data: { user: student }, request: saveReq({ answers: { q1: 'B' }, doubtful: { q1: true } }), params: { id: 'a1' } } as any);
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.success).toBe(true);
    const bound = db.prepare.mock.calls.find(([sql]: [string]) => sql.includes('INSERT OR REPLACE INTO cbt_attempt_answers')) as any[];
    expect(bound).toBeTruthy();
  });

  it('rejects answers with unknown question or invalid option', async () => {
    const db = saveDb({
      attempt: { id: 'a1', exam_id: 'e1', status: 'in_progress', expires_at: new Date(Date.now() + 600_000).toISOString() },
      questions: [{ id: 'q1', correctAnswer: 'A' }],
    });
    const response = await saveAttempt({ env: { DB: db }, data: { user: student }, request: saveReq({ answers: { q9: 'A' } }), params: { id: 'a1' } } as any);
    expect(response.status).toBe(400);
    const response2 = await saveAttempt({ env: { DB: db }, data: { user: student }, request: saveReq({ answers: { q1: 'F' } }), params: { id: 'a1' } } as any);
    expect(response2.status).toBe(400);
  });

  it('rejects save after submission or expiry', async () => {
    const db = saveDb({ attempt: { id: 'a1', exam_id: 'e1', status: 'submitted', expires_at: new Date(Date.now() + 600_000).toISOString() } });
    const response = await saveAttempt({ env: { DB: db }, data: { user: student }, request: saveReq({ answers: {} }), params: { id: 'a1' } } as any);
    expect(response.status).toBe(409);
  });
});

describe('CBT summary API', () => {
  function summaryDb(rows: any[]) {
    const all = vi.fn(async (sql?: string) => {
      if (sql?.includes('domain_migrations')) return { results: [{ key: 'legacy_cbt_v1' }] };
      return { results: rows };
    });
    const first = vi.fn(async () => ({ key: 'legacy_cbt_v1' }));
    const prepare = vi.fn((sql: string) => ({ bind: vi.fn(() => ({ first, all })), all, first }));
    return { prepare } as any;
  }

  it('aggregates submitted attempts per student for admin', async () => {
    const db = summaryDb([
      { siswaId: 'u1', siswaName: 'Siswa Satu', nisn: '123', examCount: 4, avgScore: 82.5, bestScore: 95, worstScore: 70 },
    ]);
    const admin = { ...student, id: 'a1', role: 'admin' } as AuthUser;
    const response = await getSummary({ env: { DB: db }, data: { user: admin } } as any);
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.data).toEqual([
      { siswaId: 'u1', siswaName: 'Siswa Satu', nisn: '123', examCount: 4, avgScore: 82.5, bestScore: 95, worstScore: 70 },
    ]);
  });

  it('requires authentication', async () => {
    const db = { prepare: vi.fn() } as any;
    const response = await getSummary({ env: { DB: db }, data: { user: null } } as any);
    expect(response.status).toBe(401);
  });
});