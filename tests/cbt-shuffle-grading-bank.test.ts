import { describe, expect, it, vi } from 'vitest';
import {
  essayKeywordHint,
  gradingStatusOf,
  hashCbtToken,
  parseProctorEvents,
  shuffleQuestionsForAttempt,
  shuffleWithSeed,
} from '../functions/_lib/cbt';
import { onRequestPost as createAttempt } from '../functions/api/cbt/exams/[id]/attempts';
import { onRequestGet as gradeGet, onRequestPost as gradePost } from '../functions/api/cbt/attempts/[id]/grade';
import { onRequestGet as reviewGet } from '../functions/api/cbt/attempts/[id]/review';
import { onRequestPost as proctorPost } from '../functions/api/cbt/attempts/[id]/proctor';
import { onRequestGet as gradingQueueGet } from '../functions/api/cbt/grading/index';
import {
  onRequestDelete as bankDelete,
  onRequestGet as bankList,
  onRequestPatch as bankUpdate,
  onRequestPost as bankCreate,
} from '../functions/api/cbt/bank/index';
import type { AuthUser } from '../functions/_lib/auth';

const student: AuthUser = {
  id: 'u1', name: 'Siswa', email: 's@example.test', nipNisn: '123', nik: null,
  tanggalLahir: null, role: 'siswa', classId: 'k1', ketuaStatus: 'none', jabatan: null,
  status: 'active', mustChangePassword: false,
};
const student2 = { ...student, id: 'u2', name: 'Siswa Dua', nipNisn: '124' } as AuthUser;
const guru = { ...student, id: 'g1', name: 'Pak Guru', role: 'guru' } as AuthUser;
const guruLain = { ...student, id: 'g2', name: 'Guru Lain', role: 'guru' } as AuthUser;
const admin = { ...student, id: 'a1', name: 'Admin', role: 'admin' } as AuthUser;

type FeatureDbOptions = {
  attempt?: any;
  exam?: any;
  questions?: any[];
  bankRows?: any[];
  queueRows?: any[];
  rosterRows?: any[];
  examAttempts?: any[];
};

// Mock D1 yang mengemulasi filter SQL yang relevan (kepemilikan attempt,
// antrean per guru, bank per pemilik) lewat argumen bind.
function featureDb({ attempt = null, exam = null, questions = [], bankRows = [], queueRows = [], rosterRows = [], examAttempts = [] }: FeatureDbOptions = {}) {
  const runs: { sql: string; args: unknown[] }[] = [];
  let insertedBankRow: any = null;
  const first = vi.fn(async (sql?: string, args: unknown[] = []) => {
    if (sql?.includes('domain_migrations')) return { key: 'legacy_cbt_v1' };
    if (sql?.includes('api_rate_limits')) return { request_count: 1 };
    if (sql?.includes('cbt_question_bank')) return insertedBankRow ?? bankRows.find(row => row.id === args[0]) ?? bankRows[0] ?? null;
    if (sql?.includes('cbt_attempt_answers')) return null;
    if (sql?.includes('cbt_exams')) return exam;
    if (sql?.includes('cbt_attempts')) {
      if (sql.includes('student_user_id') && attempt && attempt.student_user_id !== args[args.length - 1]) return null;
      return attempt;
    }
    return null;
  });
  const all = vi.fn(async (sql?: string, args: unknown[] = []) => {
    if (sql?.includes('domain_migrations')) return { results: [{ key: 'legacy_cbt_v1' }] };
    if (sql?.includes('cbt_question_bank')) {
      if (sql.includes('owner_user_id=?')) {
        return { results: bankRows.filter(row => row.owner_user_id === args[0] || (row.owner_user_id == null && row.owner_name === args[1])) };
      }
      return { results: bankRows };
    }
    if (sql?.includes('FROM users')) return { results: rosterRows };
    if (sql?.includes('FROM cbt_attempts WHERE exam_id')) return { results: examAttempts };
    if (sql?.includes('cbt_attempts')) {
      if (sql.includes('teacher_user_id=?')) {
        return { results: queueRows.filter(row => row.teacherId === args[0] || (row.teacherId == null && row.teacherName === args[1])) };
      }
      return { results: queueRows };
    }
    if (sql?.includes('cbt_questions')) return { results: questions };
    if (sql?.includes('cbt_exams')) return { results: exam ? [exam] : [] };
    return { results: [] };
  });
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn((...args: unknown[]) => ({
      first: () => first(sql, args),
      all: () => all(sql, args),
      run: async () => {
        runs.push({ sql, args });
        if (sql.includes('INSERT INTO cbt_question_bank')) {
          const [id, owner_user_id, owner_name, subject, topic, question_type, question, options_json, correct_answer, explanation] = args as any[];
          insertedBankRow = { id, owner_user_id, owner_name, subject, topic, question_type, question, options_json, correct_answer, explanation, created_at: 'x', updated_at: 'x' };
        }
        return { success: true };
      },
    })),
    first: () => first(sql),
    all: () => all(sql),
    run: async () => { runs.push({ sql, args: [] }); return { success: true }; },
  }));
  return { db: { prepare } as any, runs };
}

function jsonReq(url: string, method: string, body: object) {
  return new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

const examRow = {
  id: 'e1', title: 'Ujian Kearsipan', subject: 'Kearsipan', teacher_user_id: 'g1', teacher_name: 'Pak Guru',
  class_target: 'k1', status: 'active', duration_minutes: 30, start_date: '2026-01-01', end_date: '2027-12-31',
  open_time: null, close_time: null, exam_type: 'latihan', min_submit_minutes: null,
};

const pgOptionsJson = JSON.stringify(['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Opsi ${key}` })));

describe('CBT shuffle (deterministik dari seed)', () => {
  it('shuffleWithSeed deterministik dan menghasilkan permutasi', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = shuffleWithSeed(items, 42);
    const b = shuffleWithSeed(items, 42);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(shuffleWithSeed(items, 7)).not.toEqual(a);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // input tidak diubah
  });

  const questions = [
    { id: 'q1', question: 'Satu?', type: 'pg', correctAnswer: 'C', options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Q1-${key}` })) },
    { id: 'q2', question: 'Dua?', type: 'pg', correctAnswer: 'A', options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Q2-${key}` })) },
    { id: 'e1', question: 'Esai?', type: 'essai', correctAnswer: 'kunci', options: [] },
  ];

  it('seed kosong mempertahankan urutan asli (kompatibilitas attempt lama)', () => {
    const result = shuffleQuestionsForAttempt(questions as any, null);
    expect(result.map(q => q.id)).toEqual(['q1', 'q2', 'e1']);
    expect(shuffleQuestionsForAttempt(questions as any, 0).map(q => q.id)).toEqual(['q1', 'q2', 'e1']);
  });

  it('opsi membawa originalKey dan huruf tampilan A-E berurutan', () => {
    const result = shuffleQuestionsForAttempt(questions as any, 1234);
    expect([...result.map(q => q.id)].sort()).toEqual(['e1', 'q1', 'q2']);
    for (const q of result) {
      if (q.type !== 'pg') continue;
      const original = questions.find(item => item.id === q.id)!;
      expect(q.options!.map(o => o.key)).toEqual(['A', 'B', 'C', 'D', 'E']);
      for (const option of q.options!) {
        const source = original.options.find(o => o.key === (option as any).originalKey);
        expect(source).toBeTruthy();
        expect(option.text).toBe(source!.text);
      }
    }
    // Deterministik: seed sama -> hasil sama persis (resume konsisten).
    expect(shuffleQuestionsForAttempt(questions as any, 1234)).toEqual(result);
  });

  it('attempt baru menyimpan seed dan menyajikan soal teracak sesuai seed itu, tanpa kunci', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const questionRows = [1, 2, 3, 4].map(n => ({
      id: `q${n}`, question: `Soal ${n}?`, question_type: 'pg', correct_answer: 'A', options_json: pgOptionsJson, explanation: null,
    }));
    const exam = { ...examRow, token_hash: await hashCbtToken('ABCD') };
    const { db, runs } = featureDb({ exam, questions: questionRows });
    const req = jsonReq('http://test/api/cbt/exams/e1/attempts', 'POST', { token: 'ABCD' });
    const response = await createAttempt({ env: { DB: db }, data: { user: student }, request: req, params: { id: 'e1' } } as any);
    expect(response.status).toBe(200);
    const insert = runs.find(r => r.sql.includes('INSERT INTO cbt_attempts'));
    expect(insert).toBeTruthy();
    const seed = insert!.args[7] as number;
    expect(seed).toBeGreaterThan(0);
    const json = await response.json() as any;
    const served = json.data.exam.questions;
    const expected = shuffleQuestionsForAttempt(questionRows.map(row => ({
      id: row.id, question: row.question, type: 'pg',
      options: JSON.parse(row.options_json),
    })) as any, seed);
    expect(served.map((q: any) => q.id)).toEqual(expected.map(q => q.id));
    expect(served[0].options.map((o: any) => o.originalKey)).toEqual(expected[0].options!.map(o => (o as any).originalKey));
    // Kunci & pembahasan tidak terkirim ke siswa selama attempt berjalan.
    expect(served.every((q: any) => q.correctAnswer === undefined)).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('CBT petunjuk kata kunci esai (bukan nilai)', () => {
  it('essayKeywordHint melaporkan token terpenuhi per alternatif terbaik', () => {
    const hint = essayKeywordHint('Arsip adalah rekaman kegiatan.', 'rekaman kegiatan|surat masuk');
    expect(hint.matched).toBe(2);
    expect(hint.total).toBe(2);
    expect(hint.complete).toBe(true);
    expect(essayKeywordHint('tidak relevan', 'rekaman kegiatan').complete).toBe(false);
  });

  it('gradingStatusOf: attempt lama tanpa status dianggap final', () => {
    expect(gradingStatusOf({ grading_status: null })).toBe('graded');
    expect(gradingStatusOf({ grading_status: 'pending_grading' })).toBe('pending_grading');
    expect(gradingStatusOf({})).toBe('graded');
  });

  it('parseProctorEvents membaca agregat dan tahan data rusak', () => {
    expect(parseProctorEvents('{"tabSwitch":3,"fullscreenExit":1}')).toEqual({ tabSwitch: 3, windowBlur: 0, fullscreenExit: 1 });
    expect(parseProctorEvents('bukan json')).toEqual({ tabSwitch: 0, windowBlur: 0, fullscreenExit: 0 });
    expect(parseProctorEvents(null)).toEqual({ tabSwitch: 0, windowBlur: 0, fullscreenExit: 0 });
  });
});

const pendingAttempt = {
  id: 'a1', exam_id: 'e1', student_user_id: 'u1', student_name: 'Siswa', nisn: '123', status: 'submitted',
  grading_status: 'pending_grading', pg_score: 50, score: 50, essay_scores_json: '{}',
  proctor_events_json: '{}', submitted_at: '2026-11-01T02:00:00.000Z', started_at: '2026-11-01T01:30:00.000Z',
  answers_json: JSON.stringify({ q1: 'A', e1: 'Arsip adalah rekaman kegiatan.' }), doubtful_json: '{}',
  correct_count: 1, wrong_count: 0, time_spent_seconds: 1800,
};
const gradeQuestions = [
  { id: 'q1', question: 'PG?', question_type: 'pg', correct_answer: 'A', options_json: pgOptionsJson, explanation: 'Pembahasan PG' },
  { id: 'e1', question: 'Esai?', question_type: 'essai', correct_answer: 'rekaman kegiatan', options_json: '[]', explanation: 'Pembahasan esai' },
];

describe('CBT koreksi esai guru', () => {
  it('GET detail koreksi: guru pemilik ujian melihat jawaban + petunjuk kata kunci', async () => {
    const { db } = featureDb({ attempt: pendingAttempt, exam: examRow, questions: gradeQuestions });
    const response = await gradeGet({ env: { DB: db }, data: { user: guru }, params: { id: 'a1' } } as any);
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.data.pgScore).toBe(50);
    expect(json.data.pointPerQuestion).toBe(50);
    expect(json.data.essays).toHaveLength(1);
    expect(json.data.essays[0].studentAnswer).toContain('rekaman kegiatan');
    expect(json.data.essays[0].hint.autoMatch).toBe(true);
    expect(json.data.essays[0].hint.matched).toBe(2);
    expect(json.data.essays[0].maxScore).toBe(50);
  });

  it('GET detail koreksi: guru lain ditolak, admin boleh, siswa ditolak', async () => {
    const { db } = featureDb({ attempt: pendingAttempt, exam: examRow, questions: gradeQuestions });
    const denied = await gradeGet({ env: { DB: db }, data: { user: guruLain }, params: { id: 'a1' } } as any);
    expect(denied.status).toBe(403);
    const allowed = await gradeGet({ env: { DB: db }, data: { user: admin }, params: { id: 'a1' } } as any);
    expect(allowed.status).toBe(200);
    const byStudent = await gradeGet({ env: { DB: db }, data: { user: student }, params: { id: 'a1' } } as any);
    expect(byStudent.status).toBe(403);
  });

  it('POST nilai lengkap: status menjadi graded dan skor akhir = PG + esai', async () => {
    const { db, runs } = featureDb({ attempt: pendingAttempt, exam: examRow, questions: gradeQuestions });
    const req = jsonReq('http://test/api/cbt/attempts/a1/grade', 'POST', { scores: { e1: 25 }, notes: { e1: 'Cukup baik' } });
    const response = await gradePost({ env: { DB: db }, data: { user: guru }, request: req, params: { id: 'a1' } } as any);
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.data.gradingStatus).toBe('graded');
    expect(json.data.score).toBe(75);
    const update = runs.find(r => r.sql.includes('UPDATE cbt_attempts'));
    expect(update).toBeTruthy();
    expect(update!.args).toContain(75);
    expect(update!.sql).toContain("'graded'");
  });

  it('POST nilai sebagian: tetap pending_grading', async () => {
    const questions2 = [...gradeQuestions, { id: 'e2', question: 'Esai 2?', question_type: 'essai', correct_answer: 'surat masuk', options_json: '[]', explanation: '' }];
    const { db } = featureDb({ attempt: pendingAttempt, exam: examRow, questions: questions2 });
    const req = jsonReq('http://test/api/cbt/attempts/a1/grade', 'POST', { scores: { e1: 30 } });
    const response = await gradePost({ env: { DB: db }, data: { user: guru }, request: req, params: { id: 'a1' } } as any);
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.data.gradingStatus).toBe('pending_grading');
    expect(json.data.essayScores).toEqual({ e1: 30 });
  });

  it('POST menolak nilai di atas bobot per soal dan attempt lama (final)', async () => {
    const { db } = featureDb({ attempt: pendingAttempt, exam: examRow, questions: gradeQuestions });
    const tooBig = await gradePost({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/attempts/a1/grade', 'POST', { scores: { e1: 51 } }), params: { id: 'a1' } } as any);
    expect(tooBig.status).toBe(400);
    const legacy = { ...pendingAttempt, grading_status: null };
    const { db: db2 } = featureDb({ attempt: legacy, exam: examRow, questions: gradeQuestions });
    const legacyRes = await gradePost({ env: { DB: db2 }, data: { user: guru }, request: jsonReq('http://test/api/cbt/attempts/a1/grade', 'POST', { scores: { e1: 10 } }), params: { id: 'a1' } } as any);
    expect(legacyRes.status).toBe(409);
  });

  it('antrean koreksi hanya memuat ujian milik guru; admin melihat semua', async () => {
    const rows = [{ attemptId: 'a1', examId: 'e1', examTitle: 'Ujian', subject: 'Kearsipan', teacherId: 'g1', teacherName: 'Pak Guru', siswaName: 'Siswa', nisn: '123', pgScore: 50, submittedAt: '2026-11-01T02:00:00.000Z', essayCount: 1 }];
    const { db } = featureDb({ queueRows: rows });
    const own = await gradingQueueGet({ env: { DB: db }, data: { user: guru } } as any);
    expect(((await own.json()) as any).data).toHaveLength(1);
    const other = await gradingQueueGet({ env: { DB: db }, data: { user: guruLain } } as any);
    expect(((await other.json()) as any).data).toHaveLength(0);
    const all = await gradingQueueGet({ env: { DB: db }, data: { user: admin } } as any);
    expect(((await all.json()) as any).data).toHaveLength(1);
    const byStudent = await gradingQueueGet({ env: { DB: db }, data: { user: student } } as any);
    expect(byStudent.status).toBe(403);
  });
});

describe('CBT review siswa pasca-submit', () => {
  it('attempt masih berjalan: kunci & pembahasan TIDAK bocor (403)', async () => {
    const running = { ...pendingAttempt, status: 'in_progress', grading_status: null };
    const { db } = featureDb({ attempt: running, exam: examRow, questions: gradeQuestions });
    const response = await reviewGet({ env: { DB: db }, data: { user: student }, params: { id: 'a1' } } as any);
    expect(response.status).toBe(403);
    const text = await response.text();
    expect(text).not.toContain('Pembahasan PG');
    expect(text).not.toContain('Pembahasan esai');
    expect(text).not.toContain('rekaman kegiatan');
  });

  it('attempt submitted: siswa pemilik melihat kunci + pembahasan', async () => {
    const { db } = featureDb({ attempt: pendingAttempt, exam: examRow, questions: gradeQuestions });
    const response = await reviewGet({ env: { DB: db }, data: { user: student }, params: { id: 'a1' } } as any);
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    const pg = json.data.exam.questions.find((q: any) => q.id === 'q1');
    expect(pg.correctAnswer).toBe('A');
    expect(pg.explanation).toBe('Pembahasan PG');
    expect(json.data.submission.gradingStatus).toBe('pending_grading');
    expect(json.data.submission.answers.e1).toContain('rekaman kegiatan');
  });

  it('siswa lain tidak bisa membuka review attempt orang lain (404)', async () => {
    const { db } = featureDb({ attempt: pendingAttempt, exam: examRow, questions: gradeQuestions });
    const response = await reviewGet({ env: { DB: db }, data: { user: student2 }, params: { id: 'a1' } } as any);
    expect(response.status).toBe(404);
  });

  describe('gerbang seluruh peserta selesai', () => {
    const roster = [{ id: 'u1' }, { id: 'u2' }];

    it('(1) siswa A sudah submit, siswa B belum mulai -> A tetap TERKUNCI', async () => {
      const { db } = featureDb({
        attempt: pendingAttempt, exam: examRow, questions: gradeQuestions,
        rosterRows: roster,
        examAttempts: [{ student_user_id: 'u1', status: 'submitted', expires_at: '2026-11-01T02:30:00.000Z' }],
      });
      const response = await reviewGet({ env: { DB: db }, data: { user: student }, params: { id: 'a1' } } as any);
      expect(response.status).toBe(200);
      const text = await response.text();
      const json = JSON.parse(text) as any;
      expect(json.data.reviewLocked).toBe('waiting_all_students');
      expect(json.data.exam).toBeUndefined();
      // Ringkasan hasil sendiri tetap tersedia, data per soal TIDAK dikirim:
      // tidak ada payload soal, tidak ada kunci, tidak ada teks pembahasan.
      // (Jawaban esai siswa sendiri memang ikut di ringkasan — itu miliknya.)
      expect(json.data.submission.score).toBe(50);
      expect(text).not.toContain('correctAnswer');
      expect(text).not.toContain('Pembahasan PG');
      expect(text).not.toContain('Pembahasan esai');
    });

    it('(1b) siswa B masih mengerjakan (in_progress belum kedaluwarsa) -> TERKUNCI', async () => {
      const { db } = featureDb({
        attempt: pendingAttempt, exam: examRow, questions: gradeQuestions,
        rosterRows: roster,
        examAttempts: [
          { student_user_id: 'u1', status: 'submitted', expires_at: '2026-11-01T02:30:00.000Z' },
          { student_user_id: 'u2', status: 'in_progress', expires_at: '2999-01-01T00:00:00.000Z' },
        ],
      });
      const response = await reviewGet({ env: { DB: db }, data: { user: student }, params: { id: 'a1' } } as any);
      const json = await response.json() as any;
      expect(json.data.reviewLocked).toBe('waiting_all_students');
      expect(json.data.exam).toBeUndefined();
    });

    it('(2) semua peserta sudah submit -> TERBUKA', async () => {
      const { db } = featureDb({
        attempt: pendingAttempt, exam: examRow, questions: gradeQuestions,
        rosterRows: roster,
        examAttempts: [
          { student_user_id: 'u1', status: 'submitted', expires_at: '2026-11-01T02:30:00.000Z' },
          { student_user_id: 'u2', status: 'submitted', expires_at: '2026-11-01T02:30:00.000Z' },
        ],
      });
      const response = await reviewGet({ env: { DB: db }, data: { user: student }, params: { id: 'a1' } } as any);
      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.data.reviewLocked).toBeUndefined();
      const pg = json.data.exam.questions.find((q: any) => q.id === 'q1');
      expect(pg.correctAnswer).toBe('A');
      expect(pg.explanation).toBe('Pembahasan PG');
    });

    it('(3) jendela berakhir + attempt menggantung in_progress lewat expires_at -> TERBUKA', async () => {
      const endedExam = { ...examRow, end_date: '2026-10-01' };
      const { db } = featureDb({
        attempt: pendingAttempt, exam: endedExam, questions: gradeQuestions,
        rosterRows: roster,
        examAttempts: [
          { student_user_id: 'u1', status: 'submitted', expires_at: '2026-09-01T02:30:00.000Z' },
          { student_user_id: 'u2', status: 'in_progress', expires_at: '2026-09-01T02:30:00.000Z' },
        ],
      });
      const response = await reviewGet({ env: { DB: db }, data: { user: student }, params: { id: 'a1' } } as any);
      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.data.reviewLocked).toBeUndefined();
      expect(json.data.exam.questions).toHaveLength(2);
    });

    it('(3b) jendela belum berakhir, tapi attempt menggantung sudah lewat expires_at diperlakukan expired -> TERBUKA', async () => {
      const { db } = featureDb({
        attempt: pendingAttempt, exam: examRow, questions: gradeQuestions,
        rosterRows: roster,
        examAttempts: [
          { student_user_id: 'u1', status: 'submitted', expires_at: '2026-11-01T02:30:00.000Z' },
          { student_user_id: 'u2', status: 'in_progress', expires_at: '2020-01-01T00:00:00.000Z' },
        ],
      });
      const response = await reviewGet({ env: { DB: db }, data: { user: student }, params: { id: 'a1' } } as any);
      const json = await response.json() as any;
      expect(json.data.reviewLocked).toBeUndefined();
      expect(json.data.exam.questions).toHaveLength(2);
    });
  });
});

describe('CBT proctoring events', () => {
  it('peristiwa diagregasi ke attempt yang sedang berjalan', async () => {
    const running = { ...pendingAttempt, status: 'in_progress', proctor_events_json: '{"tabSwitch":1}' };
    const { db, runs } = featureDb({ attempt: running });
    const req = jsonReq('http://test/api/cbt/attempts/a1/proctor', 'POST', { events: [{ type: 'tab_switch', at: '2026-11-01T01:35:00.000Z' }, { type: 'tab_switch', at: '2026-11-01T01:36:00.000Z' }, { type: 'fullscreen_exit', at: '2026-11-01T01:37:00.000Z' }] });
    const response = await proctorPost({ env: { DB: db }, data: { user: student }, request: req, params: { id: 'a1' } } as any);
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.data.tabSwitch).toBe(3);
    expect(json.data.windowBlur).toBe(0);
    expect(json.data.fullscreenExit).toBe(1);
    expect(json.data.accepted).toBe(3);
    const update = runs.find(r => r.sql.includes('proctor_events_json'));
    expect(update).toBeTruthy();
    expect(String(update!.args[0])).toContain('"tabSwitch":3');
  });

  it('jenis peristiwa tidak dikenal ditolak; attempt orang lain 404; attempt selesai 409', async () => {
    const running = { ...pendingAttempt, status: 'in_progress' };
    const { db } = featureDb({ attempt: running });
    const unknown = await proctorPost({ env: { DB: db }, data: { user: student }, request: jsonReq('http://test/api/cbt/attempts/a1/proctor', 'POST', { events: [{ type: 'tidak_dikenal' }] }), params: { id: 'a1' } } as any);
    expect(unknown.status).toBe(400);
    const other = await proctorPost({ env: { DB: db }, data: { user: student2 }, request: jsonReq('http://test/api/cbt/attempts/a1/proctor', 'POST', { events: [{ type: 'tab_switch' }] }), params: { id: 'a1' } } as any);
    expect(other.status).toBe(404);
    const { db: db2 } = featureDb({ attempt: pendingAttempt });
    const done = await proctorPost({ env: { DB: db2 }, data: { user: student }, request: jsonReq('http://test/api/cbt/attempts/a1/proctor', 'POST', { events: [{ type: 'tab_switch' }] }), params: { id: 'a1' } } as any);
    expect(done.status).toBe(409);
  });
});

describe('CBT bank soal', () => {
  const pgBody = {
    subject: 'Kearsipan', topic: 'Dasar',
    question: { id: 'bank-1', question: 'Apa itu arsip?', type: 'pg', correctAnswer: 'B', explanation: 'Karena...', options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Opsi ${key}` })) },
  };
  const bankRow = { id: 'b1', owner_user_id: 'g1', owner_name: 'Pak Guru', subject: 'Kearsipan', topic: null, question_type: 'pg', question: 'Q?', options_json: pgOptionsJson, correct_answer: 'A', explanation: null, created_at: 'x', updated_at: 'x' };

  it('guru membuat soal bank; item tersimpan lengkap untuk disalin (snapshot)', async () => {
    const { db, runs } = featureDb({});
    const response = await bankCreate({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/bank', 'POST', pgBody) } as any);
    expect(response.status).toBe(201);
    const json = await response.json() as any;
    expect(json.data.subject).toBe('Kearsipan');
    expect(json.data.question).toBe('Apa itu arsip?');
    expect(json.data.correctAnswer).toBe('B');
    expect(json.data.options).toHaveLength(5);
    expect(json.data.ownerUserId).toBe('g1');
    expect(runs.some(r => r.sql.includes('INSERT INTO cbt_question_bank'))).toBe(true);
  });

  it('validasi bank memakai aturan soal CBT (PG wajib 5 opsi)', async () => {
    const { db } = featureDb({});
    const bad = { ...pgBody, question: { ...pgBody.question, options: pgBody.question.options.slice(0, 4) } };
    const response = await bankCreate({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/bank', 'POST', bad) } as any);
    expect(response.status).toBe(400);
  });

  it('siswa tidak punya akses bank; guru hanya melihat miliknya', async () => {
    const { db } = featureDb({ bankRows: [bankRow] });
    const byStudent = await bankList({ env: { DB: db }, data: { user: student }, request: new Request('http://test/api/cbt/bank') } as any);
    expect(byStudent.status).toBe(403);
    const own = await bankList({ env: { DB: db }, data: { user: guru }, request: new Request('http://test/api/cbt/bank') } as any);
    expect(((await own.json()) as any).data).toHaveLength(1);
    const other = await bankList({ env: { DB: db }, data: { user: guruLain }, request: new Request('http://test/api/cbt/bank') } as any);
    expect(((await other.json()) as any).data).toHaveLength(0);
  });

  it('guru lain tidak bisa mengubah/menghapus soal bank orang lain', async () => {
    const { db } = featureDb({ bankRows: [bankRow] });
    const patch = await bankUpdate({ env: { DB: db }, data: { user: guruLain }, request: jsonReq('http://test/api/cbt/bank', 'PATCH', { id: 'b1', ...pgBody }) } as any);
    expect(patch.status).toBe(403);
    const del = await bankDelete({ env: { DB: db }, data: { user: guruLain }, request: jsonReq('http://test/api/cbt/bank', 'DELETE', { id: 'b1' }) } as any);
    expect(del.status).toBe(403);
    const delOwn = await bankDelete({ env: { DB: db }, data: { user: guru }, request: jsonReq('http://test/api/cbt/bank', 'DELETE', { id: 'b1' }) } as any);
    expect(delOwn.status).toBe(200);
  });
});
