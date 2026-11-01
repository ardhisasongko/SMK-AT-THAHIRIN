import { describe, expect, it, vi } from 'vitest';
import { onRequestPatch as examPatch, onRequestPost as examCreate } from '../functions/api/cbt/exams/index';
import {
  onRequestPatch as bankUpdate,
  onRequestPost as bankCreate,
} from '../functions/api/cbt/bank/index';
import { validateGeneratedCbt } from '../functions/api/cbt/generate';
import type { AuthUser } from '../functions/_lib/auth';

// Penonaktifan pembuatan soal esai (1 November 2026): semua jalur pembuatan
// (API ujian, bank soal, generator AI) menolak esai; paket warisan yang sudah
// berisi esai tetap dapat diedit selama esainya dipertahankan PERSIS seperti
// tersimpan (jalur pengerjaan/koreksi esai warisan diuji di file lain dan
// datanya disemai langsung di lapisan data, bukan lewat jalur pembuatan).

const guru = {
  id: 'g1', name: 'Pak Guru', email: 'g@example.test', nipNisn: null, nik: null,
  tanggalLahir: null, role: 'guru', classId: null, ketuaStatus: 'none', jabatan: null,
  status: 'active', mustChangePassword: false,
} as AuthUser;

function jsonReq(url: string, method: string, body: object) {
  return new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

const pgOptions = ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Opsi ${key}` }));
const pgQuestion = { id: 'q1', question: 'Pertanyaan PG?', type: 'pg', correctAnswer: 'A', options: pgOptions };
const essayQuestion = { id: 'e1', question: 'Jelaskan pengertian arsip!', type: 'essai', correctAnswer: 'rekaman kegiatan', options: [] };

const examBodyBase = {
  title: 'Ujian Kearsipan', subject: 'Kearsipan', classTarget: 'all', durationMinutes: 30,
  token: 'ABCD', startDate: '2026-08-15', endDate: '2026-08-16',
};

// Mock DB minimal untuk endpoint exams: exam tersimpan + soal tersimpan
// disemai langsung (mensimulasikan paket warisan di lapisan data).
function examsDb({ exam = null as any, storedQuestionRows = [] as any[], attempt = null as any } = {}) {
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn((..._args: unknown[]) => ({
      first: vi.fn(async () => {
        if (sql.includes('cbt_attempts')) return attempt;
        if (sql.includes('cbt_exams')) return exam;
        return null;
      }),
      all: vi.fn(async () => ({ results: sql.includes('cbt_questions') ? storedQuestionRows : [] })),
      run: vi.fn(async () => ({ success: true })),
    })),
    first: vi.fn(async () => null),
    all: vi.fn(async () => ({ results: [] })),
    run: vi.fn(async () => ({ success: true })),
  }));
  return { prepare, batch: vi.fn(async () => []) } as any;
}

describe('API ujian: pembuatan esai ditolak', () => {
  it('(a) POST paket berisi soal esai -> 400 dengan pesan jelas', async () => {
    const db = examsDb();
    const response = await examCreate({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/exams', 'POST', { ...examBodyBase, questions: [pgQuestion, essayQuestion] }) } as any);
    expect(response.status).toBe(400);
    const json = await response.json() as any;
    expect(json.error).toMatch(/esai tidak lagi dapat dibuat/i);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('POST paket pilihan ganda saja tetap diterima (201)', async () => {
    const db = examsDb();
    const response = await examCreate({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/exams', 'POST', { ...examBodyBase, questions: [pgQuestion] }) } as any);
    expect(response.status).toBe(201);
    expect(db.batch).toHaveBeenCalled();
  });
});

describe('API ujian: edit paket warisan berisi esai', () => {
  const examRow = {
    id: 'e1', title: 'Ujian Warisan', subject: 'Kearsipan', teacher_user_id: 'g1', teacher_name: 'Pak Guru',
    class_target: 'all', status: 'active', is_active: 1, start_date: '2026-08-15', end_date: '2026-08-16',
  };
  const storedRows = [
    { id: 'q1', question: 'Pertanyaan PG?', question_type: 'pg', options_json: JSON.stringify(pgOptions), correct_answer: 'A', explanation: null },
    { id: 'e1', question: 'Jelaskan pengertian arsip!', question_type: 'essai', options_json: '[]', correct_answer: 'rekaman kegiatan', explanation: null },
  ];
  const patchBody = {
    id: 'e1', title: 'Ujian Warisan (judul diperbarui)', subject: 'Kearsipan', classTarget: 'all',
    durationMinutes: 45, startDate: '2026-08-15', endDate: '2026-08-17',
  };

  it('(c) esai warisan dipertahankan apa adanya -> diterima (200)', async () => {
    const db = examsDb({ exam: examRow, storedQuestionRows: storedRows });
    const response = await examPatch({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/exams', 'PATCH', { ...patchBody, questions: [pgQuestion, essayQuestion] }) } as any);
    expect(response.status).toBe(200);
    expect(db.batch).toHaveBeenCalled();
  });

  it('(c) teks esai warisan diubah -> ditolak (400)', async () => {
    const db = examsDb({ exam: examRow, storedQuestionRows: storedRows });
    const changed = { ...essayQuestion, question: 'Jelaskan pengertian arsip versi baru!' };
    const response = await examPatch({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/exams', 'PATCH', { ...patchBody, questions: [pgQuestion, changed] }) } as any);
    expect(response.status).toBe(400);
    const json = await response.json() as any;
    expect(json.error).toMatch(/esai warisan tidak dapat diubah/i);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('(c) kunci esai warisan diubah -> ditolak (400)', async () => {
    const db = examsDb({ exam: examRow, storedQuestionRows: storedRows });
    const changed = { ...essayQuestion, correctAnswer: 'kunci yang diganti' };
    const response = await examPatch({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/exams', 'PATCH', { ...patchBody, questions: [pgQuestion, changed] }) } as any);
    expect(response.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('(c) esai baru (id baru) pada edit paket -> ditolak (400)', async () => {
    const db = examsDb({ exam: examRow, storedQuestionRows: storedRows });
    const newEssay = { ...essayQuestion, id: 'e2' };
    const response = await examPatch({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/exams', 'PATCH', { ...patchBody, questions: [pgQuestion, essayQuestion, newEssay] }) } as any);
    expect(response.status).toBe(400);
    const json = await response.json() as any;
    expect(json.error).toMatch(/esai tidak lagi dapat dibuat/i);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('esai warisan dihapus dari payload edit -> diterima (200)', async () => {
    const db = examsDb({ exam: examRow, storedQuestionRows: storedRows });
    const response = await examPatch({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/exams', 'PATCH', { ...patchBody, questions: [pgQuestion] }) } as any);
    expect(response.status).toBe(200);
    expect(db.batch).toHaveBeenCalled();
  });
});

describe('API bank soal: pembuatan/pengubahan esai ditolak', () => {
  const essayBankBody = {
    subject: 'Kearsipan',
    question: { id: 'bank-1', question: 'Jelaskan arsip!', type: 'essai', correctAnswer: 'rekaman kegiatan', options: [] },
  };
  const legacyBankRow = {
    id: 'b-essai', owner_user_id: 'g1', owner_name: 'Pak Guru', subject: 'Kearsipan', topic: null,
    question_type: 'essai', question: 'Jelaskan arsip!', options_json: '[]', correct_answer: 'rekaman kegiatan',
    explanation: null, created_at: 'x', updated_at: 'x',
  };

  function bankDb(row: any = null) {
    const prepare = vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => (sql.includes('cbt_question_bank') ? row : null)),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ success: true })),
      })),
    }));
    return { prepare } as any;
  }

  it('(b) POST soal bank esai -> 400', async () => {
    const db = bankDb();
    const response = await bankCreate({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/bank', 'POST', essayBankBody) } as any);
    expect(response.status).toBe(400);
    const json = await response.json() as any;
    expect(json.error).toMatch(/esai tidak lagi dapat dibuat/i);
  });

  it('(b) PATCH baris bank esai warisan -> 400 (hanya dapat dihapus)', async () => {
    const db = bankDb(legacyBankRow);
    const pgPayload = {
      id: 'b-essai', subject: 'Kearsipan',
      question: { id: 'bank-1', question: 'Soal PG pengganti?', type: 'pg', correctAnswer: 'A', options: pgOptions },
    };
    const response = await bankUpdate({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/bank', 'PATCH', pgPayload) } as any);
    expect(response.status).toBe(400);
    const json = await response.json() as any;
    expect(json.error).toMatch(/esai warisan tidak dapat diubah/i);
  });

  it('(b) PATCH baris bank PG menjadi esai -> 400', async () => {
    const pgRow = { ...legacyBankRow, id: 'b-pg', question_type: 'pg', options_json: JSON.stringify(pgOptions), correct_answer: 'A' };
    const db = bankDb(pgRow);
    const response = await bankUpdate({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/bank', 'PATCH', { id: 'b-pg', ...essayBankBody }) } as any);
    expect(response.status).toBe(400);
    expect(((await response.json()) as any).error).toMatch(/esai tidak lagi dapat dibuat/i);
  });
});

describe('Generator AI: hanya mengeluarkan pilihan ganda', () => {
  const aiPg = (n: number) => ({
    id: `ai-${n}`, type: 'pg', question: `Soal AI ${n}?`, points: 1, correctAnswer: 'A',
    explanation: 'Pembahasan AI', options: pgOptions.map(option => ({ ...option })),
  });
  const aiEssay = { id: 'ai-x', type: 'essai', question: 'Jelaskan!', correctAnswer: 'teks kunci', points: 1, explanation: 'Pembahasan', options: [] };

  it('(d) keluaran model yang tercampur esai: esai dibuang, hanya PG yang lolos', () => {
    const result = validateGeneratedCbt([aiPg(1), aiEssay, aiPg(2), aiPg(3)], 3);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(result!.every(question => question.type === 'pg')).toBe(true);
    expect(result!.map(question => question.id)).toEqual(['ai-1', 'ai-2', 'ai-3']);
  });

  it('(d) jumlah PG dari model kurang dari yang diminta -> ditolak (null)', () => {
    expect(validateGeneratedCbt([aiPg(1), aiEssay], 3)).toBeNull();
    expect(validateGeneratedCbt([aiEssay], 1)).toBeNull();
  });
});
