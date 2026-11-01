// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callGeminiJson } from '../functions/_lib/gemini';
import {
  consumeGeminiQuota, getGeminiQuotaStatus, parseGeminiDailyLimit, wibDayString,
} from '../functions/_lib/gemini-quota';
import { onRequestPost as generateCbt } from '../functions/api/cbt/generate';
import { onRequestPost as generateModul } from '../functions/api/modul-ajar/generate';

vi.mock('../functions/_lib/gemini', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/gemini')>('../functions/_lib/gemini');
  return { ...actual, callGeminiJson: vi.fn() };
});

class TestD1Database {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys=ON');
    const files = readdirSync(new URL('../migrations', import.meta.url)).sort();
    for (const file of files) {
      this.sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    }
  }

  prepare(query: string) {
    const statement = this.sqlite.prepare(query);
    let values: unknown[] = [];
    const prepared = {
      bind: (...bindings: unknown[]) => { values = bindings; return prepared; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
    };
    return prepared;
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const stmt of statements) results.push(await stmt.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  run(query: string, ...values: unknown[]) {
    return this.sqlite.prepare(query).run(...values);
  }
}

const USER = { id: 'guru-1', role: 'guru' } as any;

function cbtQuestion() {
  return {
    id: 'ai-1', type: 'pg', question: 'Pertanyaan?',
    options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Pilihan ${key}` })),
    correctAnswer: 'A', points: 1, explanation: 'Karena A benar.',
  };
}

function modul() {
  return {
    judul: 'Modul Ajar Kearsipan',
    identitas: {
      sekolah: 'SMK PLUS AT-THAHIRIN', mataPelajaran: 'Kearsipan', jurusan: 'MPLB',
      faseKelas: 'Fase F', alokasiWaktu: '2 x 45 menit', tahunAjaran: '2026/2027',
    },
    profilPelajarPancasila: ['Mandiri'],
    saranaPrasarana: ['Komputer'],
    targetPesertaDidik: 'Siswa SMK',
    modelPembelajaran: 'PjBL',
    komponenInti: {
      tujuanPembelajaran: ['Memahami arsip'],
      pemahamanBermakna: 'Arsip mendukung pekerjaan.',
      pertanyaanPemantik: ['Mengapa arsip penting?'],
      kegiatanPembelajaran: { pendahuluan: ['Apersepsi'], inti: ['Praktik'], penutup: ['Refleksi'] },
      asesmen: { diagnostik: 'Tanya jawab', formatif: 'Observasi', sumatif: 'Proyek' },
      pengayaanDanRemidial: 'Latihan lanjutan.',
    },
    lampiran: {
      lembarKerjaSiswa: 'Instruksi kerja.', bahanBacaanGuruSiswa: 'Ringkasan.', glosarium: ['Arsip: rekaman'],
    },
  };
}

function post(path: string, body: unknown) {
  return new Request(`https://school.test${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(callGeminiJson).mockReset();
});

describe('hardening Fase D — helper kuota AI', () => {
  it('wibDayString memakai kalender WIB (UTC+7)', () => {
    expect(wibDayString(new Date('2026-11-02T16:30:00.000Z'))).toBe('2026-11-02'); // 23:30 WIB
    expect(wibDayString(new Date('2026-11-02T17:30:00.000Z'))).toBe('2026-11-03'); // 00:30 WIB besok
    expect(wibDayString(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01'); // 07:00 WIB
  });

  it('parseGeminiDailyLimit: kosong/0/tidak valid = tanpa batas', () => {
    expect(parseGeminiDailyLimit(undefined)).toBe(0);
    expect(parseGeminiDailyLimit('')).toBe(0);
    expect(parseGeminiDailyLimit('0')).toBe(0);
    expect(parseGeminiDailyLimit('abc')).toBe(0);
    expect(parseGeminiDailyLimit('-5')).toBe(0);
    expect(parseGeminiDailyLimit('200')).toBe(200);
  });

  it('penghitung naik, batas menolak, dan hari baru mulai dari nol', async () => {
    const db = new TestD1Database() as unknown as D1Database;
    const raw = db as unknown as TestD1Database;
    const env = { GEMINI_DAILY_LIMIT: '3' };
    const today = new Date();
    expect((await consumeGeminiQuota(db, env, today)).used).toBe(1);
    expect((await consumeGeminiQuota(db, env, today)).used).toBe(2);
    const third = await consumeGeminiQuota(db, env, today);
    expect(third.allowed).toBe(true);
    const fourth = await consumeGeminiQuota(db, env, today);
    expect(fourth.allowed).toBe(false);
    expect(fourth.used).toBe(4);

    // Baris kemarin yang penuh tidak memengaruhi hari ini.
    const yesterday = wibDayString(new Date(Date.now() - 24 * 3600 * 1000));
    raw.run('INSERT OR REPLACE INTO gemini_daily_usage (day, request_count, updated_at) VALUES (?, 999, ?)', yesterday, new Date().toISOString());
    const status = await getGeminiQuotaStatus(db, env, today);
    expect(status.used).toBe(4);
    expect(status.day).toBe(wibDayString(today));

    // Tanpa batas: selalu boleh walau penghitung terus naik.
    const unlimited = { GEMINI_DAILY_LIMIT: '' };
    for (let i = 0; i < 5; i++) {
      expect((await consumeGeminiQuota(db, unlimited, today)).allowed).toBe(true);
    }
  });

  it('fail-open bila tabel belum ada (deployment pra-migrasi 0032)', async () => {
    const bare = {
      prepare: () => { throw new Error('no such table: gemini_daily_usage'); },
    } as unknown as D1Database;
    const result = await consumeGeminiQuota(bare, { GEMINI_DAILY_LIMIT: '1' });
    expect(result.allowed).toBe(true);
  });
});

describe('hardening Fase D — kuota di endpoint AI', () => {
  function makeEnv(db: TestD1Database, limit: string) {
    return {
      DB: db as unknown as D1Database,
      GEMINI_ENABLED: 'true', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test',
      GEMINI_DAILY_LIMIT: limit, APP_NAME: 'Portal Test',
    };
  }

  it('generate CBT ditolak 429 setelah batas deployment tercapai; Modul Ajar berbagi penghitung yang sama', async () => {
    const db = new TestD1Database();
    const env = makeEnv(db, '1');
    vi.mocked(callGeminiJson).mockResolvedValue([cbtQuestion()] as any);

    const first = await generateCbt({ env, data: { user: USER }, request: post('/api/cbt/generate', { subject: 'Kearsipan', count: 1 }) } as any);
    expect(first.status).toBe(200);

    const second = await generateCbt({ env, data: { user: USER }, request: post('/api/cbt/generate', { subject: 'Kearsipan', count: 1 }) } as any);
    expect(second.status).toBe(429);
    expect(((await second.json()) as any).error).toContain('Kuota AI harian sekolah');

    vi.mocked(callGeminiJson).mockResolvedValue(modul() as any);
    const modulRes = await generateModul({
      env, data: { user: USER },
      request: post('/api/modul-ajar/generate', { mataPelajaran: 'Kearsipan', faseKelas: 'Fase F' }),
    } as any);
    expect(modulRes.status).toBe(429);
  });

  it('env tanpa batas: generate berulang tetap berjalan dan penghitung tetap tercatat', async () => {
    const db = new TestD1Database();
    const env = makeEnv(db, '');
    vi.mocked(callGeminiJson).mockResolvedValue([cbtQuestion()] as any);
    for (let i = 0; i < 3; i++) {
      const res = await generateCbt({ env, data: { user: USER }, request: post('/api/cbt/generate', { subject: 'Kearsipan', count: 1 }) } as any);
      expect(res.status).toBe(200);
    }
    const status = await getGeminiQuotaStatus(env.DB, env);
    expect(status.used).toBe(3);
    expect(status.limit).toBe(0);
  });
});
