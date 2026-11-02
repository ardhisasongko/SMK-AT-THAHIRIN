// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { buildXlsx, XLSX_MIME } from '../functions/_lib/xlsx';
import { buildXlsxBytes } from '../src/utils/xlsx';
import { onRequestGet as exportScores } from '../functions/api/cbt/export/scores';
import { onRequestGet as raporGet } from '../functions/api/rapor/[nisn]';

function readWorkbook(bytes: Uint8Array): XLSX.WorkBook {
  return XLSX.read(Buffer.from(bytes), { type: 'buffer' });
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Array<Array<unknown>> {
  const worksheet = workbook.Sheets[sheetName];
  expect(worksheet, `sheet ${sheetName}`).toBeTruthy();
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as Array<Array<unknown>>;
}

function expectNoFormulaCells(workbook: XLSX.WorkBook): void {
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    for (const [address, cell] of Object.entries(worksheet)) {
      if (address.startsWith('!')) continue;
      expect((cell as XLSX.CellObject).f, `sel ${name}!${address} tidak boleh formula`).toBeUndefined();
    }
  }
}

describe('buildXlsx (server) — berkas Excel nilai CBT', () => {
  const rows: Array<Array<unknown>> = [
    ['NISN', 'Nama Siswa', 'Tanggal Kirim', 'Ujian', 'Mapel', 'Jenis', 'Skor'],
    ['0071234567', 'Budi Santoso', '2026-08-17T01:00:00Z', 'UAS Kearsipan', 'Kearsipan', 'ujian', 90],
    ['0071234568', '=2+2', '2026-08-17T02:00:00Z', '+SUM(A1:A2)', '-bukan skor', '@Kearsipan', 75],
  ];

  it('menghasilkan xlsx valid (magic PK) yang bisa dibaca balik dengan isi sama', () => {
    const bytes = buildXlsx('Nilai CBT', rows);
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'

    const workbook = readWorkbook(bytes);
    expect(workbook.SheetNames).toEqual(['Nilai CBT']);
    expect(sheetRows(workbook, 'Nilai CBT')).toEqual(rows);
  });

  it('sel berawalan =, +, -, @ tersimpan sebagai teks murni — bukan formula', () => {
    const workbook = readWorkbook(buildXlsx('Nilai CBT', rows));
    expectNoFormulaCells(workbook);
    const worksheet = workbook.Sheets['Nilai CBT'];
    // Baris data kedua (baris ke-3 di sheet): nama & judul berbahaya tetap teks persis.
    expect(worksheet['B3']).toMatchObject({ t: 's', v: '=2+2' });
    expect(worksheet['D3']).toMatchObject({ t: 's', v: '+SUM(A1:A2)' });
    expect(worksheet['E3']).toMatchObject({ t: 's', v: '-bukan skor' });
    expect(worksheet['F3']).toMatchObject({ t: 's', v: '@Kearsipan' });
    // NISN dengan nol di depan tidak berubah menjadi angka.
    expect(worksheet['A2']).toMatchObject({ t: 's', v: '0071234567' });
    expect(XLSX_MIME).toContain('spreadsheetml.sheet');
  });
});

describe('buildXlsxBytes (klien) — rekap absensi', () => {
  it('menghasilkan xlsx valid dengan sheet "Rekap Absensi" dan isi sama', async () => {
    const rows: Array<Array<unknown>> = [
      ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Total', 'Persentase'],
      [1, '0071234567', 'Budi Santoso', 'X MPLB 1', 12, 1, 0, 0, 13, '92%'],
      [2, '0071234568', '=Nama Jahat', '@Kelas Palsu', 10, 0, 2, 1, 13, '77%'],
    ];
    const bytes = await buildXlsxBytes('Rekap Absensi', rows);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const workbook = readWorkbook(bytes);
    expect(workbook.SheetNames).toEqual(['Rekap Absensi']);
    expect(sheetRows(workbook, 'Rekap Absensi')).toEqual(rows);
    expectNoFormulaCells(workbook);
  });
});

// --- Fixture handler (pola yang sama dengan tests/rapor-export.test.ts) ---

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
    if (sql.includes('api_rate_limits')) return { request_count: 1 };
    if (sql.includes('sessions WHERE token')) return SESSION;
    if (sql.includes('FROM users u WHERE')) return { ...state.userRow };
    if (sql.includes('FROM students WHERE')) {
      return state.students.find(s => s.nisn === binds[0] && s.active) || null;
    }
    if (sql.includes('FROM school_classes')) return state.classes.find(c => c.id === binds[0]) || null;
    return null;
  };
  const allBySql = (sql: string) => {
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
      all: vi.fn(async () => allBySql(sql)),
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

describe('GET /api/cbt/export/scores?format=xlsx — ekspor nilai Excel', () => {
  it('menghasilkan xlsx dengan header & baris yang sama seperti CSV', async () => {
    const { db } = makeDb({ role: 'guru' });
    const response = await exportScores({ env: { DB: db }, request: request('https://example.com/api/cbt/export/scores?format=xlsx') } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers.get('Content-Disposition')).toContain('.xlsx');

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const workbook = readWorkbook(bytes);
    expect(workbook.SheetNames).toEqual(['Nilai CBT']);
    const rows = sheetRows(workbook, 'Nilai CBT');
    expect(rows[0]).toEqual(['NISN', 'Nama Siswa', 'Tanggal Kirim', 'Ujian', 'Mapel', 'Jenis', 'Skor', 'Skor PG', 'Status Koreksi', 'Benar (PG)', 'Salah (PG)', 'Waktu (detik)']);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('0071234567');
    expect(rows[1]).toContain('Budi Santoso');
    expect(rows[1]).toContain('UAS Kearsipan');
    expect(rows[1]).toContain(90);
  });

  it('nama siswa berawalan formula tetap teks di xlsx (bukan formula)', async () => {
    const { db } = makeDb({
      role: 'admin',
      attempts: [{ nisn: '0071234568', student_name: '=2+2', submitted_at: '2026-08-17T01:00:00Z', score: 75, correct_count: 7, wrong_count: 3, time_spent_seconds: 200, title: '@Ujian Palsu', subject: 'Kearsipan', exam_type: 'latihan' }],
    });
    const response = await exportScores({ env: { DB: db }, request: request('https://example.com/api/cbt/export/scores?format=xlsx') } as any);
    expect(response.status).toBe(200);

    const workbook = readWorkbook(new Uint8Array(await response.arrayBuffer()));
    expectNoFormulaCells(workbook);
    const rows = sheetRows(workbook, 'Nilai CBT');
    expect(rows[1]).toContain('=2+2');
    expect(rows[1]).toContain('@Ujian Palsu');
  });

  it('siswa tetap ditolak (403) untuk format xlsx', async () => {
    const { db } = makeDb({ role: 'siswa' });
    const response = await exportScores({ env: { DB: db }, request: request('https://example.com/api/cbt/export/scores?format=xlsx') } as any);
    expect(response.status).toBe(403);
  });
});

describe('GET /api/rapor/:nisn?format=xlsx — rapor Excel', () => {
  it('menghasilkan xlsx rapor dengan isi yang sama seperti CSV', async () => {
    const { db } = makeDb({ role: 'admin' });
    const response = await raporGet({ env: { DB: db }, request: request('https://example.com/api/rapor/0071234567?format=xlsx'), params: { nisn: '0071234567' } } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers.get('Content-Disposition')).toContain('rapor-0071234567.xlsx');

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const workbook = readWorkbook(bytes);
    expect(workbook.SheetNames).toEqual(['Rapor']);
    const flat = sheetRows(workbook, 'Rapor').flat().filter(v => v !== undefined && v !== '');
    expect(flat).toContain('RAPOR');
    expect(flat).toContain('Budi Santoso');
    expect(flat).toContain('PRESENSI');
    expect(flat).toContain('NILAI CBT');
    expect(flat).toContain('UAS Kearsipan');
    expect(flat).toContain('RATA-RATA NILAI');
    expectNoFormulaCells(workbook);
  });
});
