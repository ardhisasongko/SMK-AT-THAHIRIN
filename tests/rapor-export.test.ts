// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as exportScores } from '../functions/api/cbt/export/scores';
import { onRequestGet as raporGet } from '../functions/api/rapor/[nisn]';

const SESSION = { token: 'sha256:x', user_id: 'u1', expires_at: new Date(Date.now() + 3600_000).toISOString() };

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1', name: 'Budi Santoso', email: 'budi@example.com', nip_nisn: '0071234567',
    nik: null, tanggal_lahir: null, role: 'guru', class_id: 'k1', ketua_status: 'none',
    jabatan: null, status: 'active', must_change_password: 0, ...overrides,
  };
}

function makeDb(options: { role?: string; attempts?: any[]; students?: any[]; classes?: any[]; attendance?: any[] } = {}) {
  const state = {
    userRow: makeUser({ role: options.role ?? 'guru' }),
    attempts: options.attempts ?? [{ nisn: '0071234567', student_name: 'Budi Santoso', submitted_at: '2026-08-17T01:00:00Z', score: 90, correct_count: 9, wrong_count: 1, time_spent_seconds: 300, title: 'UAS Kearsipan', subject: 'Kearsipan', exam_type: 'ujian' }],
    students: options.students ?? [{ nisn: '0071234567', name: 'Budi Santoso', class_id: 'k1', active: 1 }],
    classes: options.classes ?? [{ id: 'k1', name: 'X MPLB 1' }],
    attendance: options.attendance ?? [{ status: 'Hadir', jumlah: 12 }, { status: 'Sakit', jumlah: 1 }],
  };
  const firstBySql = (sql: string, binds: unknown[]) => {
    if (sql.includes('sessions WHERE token')) return SESSION;
    if (sql.includes('FROM users u WHERE')) return { ...state.userRow };
    if (sql.includes('FROM students WHERE')) {
      return state.students.find(s => s.nisn === binds[0] && s.active) || null;
    }
    if (sql.includes('FROM school_classes')) return state.classes.find(c => c.id === binds[0]) || null;
    return null;
  };
  const allBySql = (sql: string, binds: unknown[]) => {
    if (sql.includes('attendance_records WHERE nisn')) {
      return { results: state.attendance };
    }
    if (sql.includes('GROUP BY e.subject')) {
      const perSubject = new Map<string, { subject: string; exam_count: number; avg_score: number; best_score: number }>();
      for (const a of state.attempts) {
        const cur = perSubject.get(a.subject) || { subject: a.subject, exam_count: 0, avg_score: 0, best_score: 0 };
        cur.exam_count += 1;
        cur.avg_score = Math.round((cur.avg_score * (cur.exam_count - 1) + a.score) / cur.exam_count);
        cur.best_score = Math.max(cur.best_score, a.score);
        perSubject.set(a.subject, cur);
      }
      return { results: [...perSubject.values()] };
    }
    if (sql.includes('FROM cbt_attempts a')) {
      return { results: state.attempts.map(a => ({ ...a })) };
    }
    return { results: [] };
  };
  const prepare = vi.fn((sql: string) => {
    const bound = (binds: unknown[]) => ({
      first: vi.fn(async () => firstBySql(sql, binds)),
      all: vi.fn(async () => allBySql(sql, binds)),
      run: vi.fn(async () => ({ success: true })),
    });
    return {
      sql,
      bind: vi.fn((...args: unknown[]) => ({ sql, binds: args, ...bound(args) })),
      ...bound([]),
    };
  });
  return { db: { prepare } as any, state };
}

function request(url: string, authed = true): Request {
  const headers: Record<string, string> = {};
  if (authed) headers.Authorization = 'Bearer st_test123';
  return new Request(url, { headers });
}

describe('GET /api/cbt/export/scores — ekspor nilai CBT', () => {
  it('guru hanya melihat ujian miliknya (bind teacher_user_id)', async () => {
    const { db } = makeDb({ role: 'guru' });
    const response = await exportScores({ env: { DB: db }, request: request('https://example.com/api/cbt/export/scores') } as any);
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(csv).toContain('NISN,Nama Siswa');
    expect(csv).toContain('0071234567,Budi Santoso');
    expect(csv).toContain('UAS Kearsipan');
  });

  it('siswa ditolak (403)', async () => {
    const { db } = makeDb({ role: 'siswa' });
    const response = await exportScores({ env: { DB: db }, request: request('https://example.com/api/cbt/export/scores') } as any);
    expect(response.status).toBe(403);
  });

  it('tanpa autentikasi ditolak (401)', async () => {
    const { db } = makeDb();
    const response = await exportScores({ env: { DB: db }, request: request('https://example.com/api/cbt/export/scores', false) } as any);
    expect(response.status).toBe(401);
  });
});

describe('GET /api/rapor/:nisn — rapor siswa', () => {
  it('admin melihat rapor lengkap siswa', async () => {
    const { db } = makeDb({ role: 'admin' });
    const response = await raporGet({ env: { DB: db }, request: request('https://example.com/api/rapor/0071234567'), params: { nisn: '0071234567' } } as any);
    const json = await response.json() as any;

    expect(response.status).toBe(200);
    expect(json.data.siswa.name).toBe('Budi Santoso');
    expect(json.data.siswa.className).toBe('X MPLB 1');
    expect(json.data.presensi.rincian.find((r: any) => r.status === 'Hadir').jumlah).toBe(12);
    expect(json.data.cbt.perMapel[0]).toMatchObject({ subject: 'Kearsipan', examCount: 1, avgScore: 90 });
    expect(json.data.ujian[0]).toMatchObject({ title: 'UAS Kearsipan', score: 90 });
  });

  it('siswa hanya bisa rapor miliknya sendiri', async () => {
    const { db } = makeDb({ role: 'siswa' });
    const ok = await raporGet({ env: { DB: db }, request: request('https://example.com/api/rapor/0071234567'), params: { nisn: '0071234567' } } as any);
    expect(ok.status).toBe(200);

    const forbidden = await raporGet({ env: { DB: db }, request: request('https://example.com/api/rapor/0099999999'), params: { nisn: '0099999999' } } as any);
    expect(forbidden.status).toBe(403);
  });

  it('NISN tidak valid atau siswa tidak ada ditolak', async () => {
    const { db } = makeDb({ role: 'admin' });
    const invalid = await raporGet({ env: { DB: db }, request: request('https://example.com/api/rapor/abc'), params: { nisn: 'abc' } } as any);
    expect(invalid.status).toBe(400);

    const missing = await raporGet({ env: { DB: db }, request: request('https://example.com/api/rapor/0099999999'), params: { nisn: '0099999999' } } as any);
    expect(missing.status).toBe(404);
  });

  it('format=csv menghasilkan CSV rapor dengan header', async () => {
    const { db } = makeDb({ role: 'admin' });
    const response = await raporGet({ env: { DB: db }, request: request('https://example.com/api/rapor/0071234567?format=csv'), params: { nisn: '0071234567' } } as any);
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(csv).toContain('RAPOR');
    expect(csv).toContain('NISN');
    expect(csv).toContain('PRESENSI');
    expect(csv).toContain('NILAI CBT');
    expect(csv).toContain('UAS Kearsipan');
  });
});