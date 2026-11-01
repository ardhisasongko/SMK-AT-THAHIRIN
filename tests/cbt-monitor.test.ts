// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { onRequestGet as monitorGet } from '../functions/api/cbt/exams/[id]/monitor/index';
import { onRequestPost as monitorAction } from '../functions/api/cbt/exams/[id]/monitor/actions';
import { onRequestGet as noticesGet } from '../functions/api/cbt/attempts/[id]/notices';
import type { AuthUser } from '../functions/_lib/auth';

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

  get<T>(query: string, ...values: unknown[]): T | undefined {
    return this.sqlite.prepare(query).get(...values) as T | undefined;
  }

  run(query: string, ...values: unknown[]) {
    return this.sqlite.prepare(query).run(...values);
  }
}

function makeUser(overrides: Partial<AuthUser> & { id: string; role: string }): AuthUser {
  return {
    name: overrides.id, email: `${overrides.id}@test.local`, nipNisn: null, nik: null,
    tanggalLahir: null, classId: null, ketuaStatus: 'none', jabatan: null,
    status: 'active', mustChangePassword: false, ...overrides,
  } as AuthUser;
}

const guru = makeUser({ id: 'g1', name: 'Pak Guru', role: 'guru' });
const guruLain = makeUser({ id: 'g2', name: 'Guru Lain', role: 'guru' });
const admin = makeUser({ id: 'a1', name: 'Admin', role: 'admin' });
const siswa1 = makeUser({ id: 's1', name: 'Andi', role: 'siswa', classId: 'k1' });
const siswa2 = makeUser({ id: 's2', name: 'Budi', role: 'siswa', classId: 'k1' });

const iso = (offsetMinutes: number) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();
const OPTIONS = JSON.stringify(['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Opsi ${key}` })));

function seed() {
  const db = new TestD1Database();
  db.run("INSERT INTO app_data (key, value) VALUES ('kelas_v1', ?)", JSON.stringify([
    { id: 'k1', name: 'X MPLB 1' },
    { id: 'k2', name: 'XI MPLB 1' },
  ]));
  const addUser = db.sqlite.prepare('INSERT INTO users (id, name, email, nip_nisn, role, class_id, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  addUser.run('g1', 'Pak Guru', 'g1@test.local', null, 'guru', null, 'x', 'active');
  addUser.run('g2', 'Guru Lain', 'g2@test.local', null, 'guru', null, 'x', 'active');
  addUser.run('s1', 'Andi', 's1@test.local', '1001', 'siswa', 'k1', 'x', 'active');
  addUser.run('s2', 'Budi', 's2@test.local', '1002', 'siswa', 'k1', 'x', 'active');
  addUser.run('s3', 'Citra', 's3@test.local', '1003', 'siswa', 'k1', 'x', 'active');
  addUser.run('s4', 'Dodi', 's4@test.local', '1004', 'siswa', 'k2', 'x', 'active');
  addUser.run('s5', 'Eka Nonaktif', 's5@test.local', '1005', 'siswa', 'k1', 'x', 'inactive');

  const addExam = db.sqlite.prepare(`INSERT INTO cbt_exams (id, title, subject, class_target, duration_minutes, token_hash, teacher_user_id, teacher_name, start_date, end_date, status, exam_type)
    VALUES (?, ?, ?, ?, ?, 'hash', ?, ?, '2026-01-01', '2027-12-31', 'active', 'latihan')`);
  addExam.run('e1', 'Ujian Kearsipan', 'Kearsipan', 'k1', 60, 'g1', 'Pak Guru');
  addExam.run('e2', 'Ujian Kelas Lain', 'Kearsipan', 'k2', 60, 'g2', 'Guru Lain');
  addExam.run('e3', 'Paket Warisan Esai', 'Kearsipan', 'k1', 60, 'g1', 'Pak Guru');
  addExam.run('e4', 'Ujian Kedaluwarsa', 'Kearsipan', 'k1', 60, 'g1', 'Pak Guru');

  const addQuestion = db.sqlite.prepare('INSERT INTO cbt_questions (exam_id, id, position, question_type, question, options_json, correct_answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  // e1: 4 soal PG, kunci A B C D — skor per soal 25.
  addQuestion.run('e1', 'q1', 0, 'pg', 'Soal 1', OPTIONS, 'A', 'Pembahasan rahasia 1');
  addQuestion.run('e1', 'q2', 1, 'pg', 'Soal 2', OPTIONS, 'B', 'Pembahasan rahasia 2');
  addQuestion.run('e1', 'q3', 2, 'pg', 'Soal 3', OPTIONS, 'C', 'Pembahasan rahasia 3');
  addQuestion.run('e1', 'q4', 3, 'pg', 'Soal 4', OPTIONS, 'D', 'Pembahasan rahasia 4');
  // e3: paket warisan — 2 PG + 1 esai (total 3 soal).
  addQuestion.run('e3', 'p1', 0, 'pg', 'PG 1', OPTIONS, 'A', 'Kunci p1');
  addQuestion.run('e3', 'p2', 1, 'pg', 'PG 2', OPTIONS, 'B', 'Kunci p2');
  addQuestion.run('e3', 'es1', 2, 'essai', 'Esai 1', '[]', 'arsip dinamis', 'Kunci esai');
  addQuestion.run('e4', 'x1', 0, 'pg', 'Soal X1', OPTIONS, 'A', 'Kunci x1');

  const addAttempt = db.sqlite.prepare(`INSERT INTO cbt_attempts (id, exam_id, student_user_id, student_name, nisn, status, started_at, expires_at, answers_json, score, correct_count, wrong_count, pg_score, grading_status, proctor_events_json, submitted_at, submitted_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  // att1: s1 sedang mengerjakan e1; autosave 3 terjawab (2 benar) + flag proctoring.
  addAttempt.run('att1', 'e1', 's1', 'Andi', '1001', 'in_progress', iso(-10), iso(50), '{}', 0, 0, 0, null, null,
    JSON.stringify({ tabSwitch: 4, windowBlur: 1, fullscreenExit: 0 }), null, 'student');
  db.run('INSERT INTO cbt_attempt_answers (attempt_id, answers_json, doubtful_json) VALUES (?, ?, ?)',
    'att1', JSON.stringify({ q1: 'A', q2: 'B', q3: 'A' }), '{}');
  // att2: s2 sudah kumpul e1 dengan nilai final 100.
  addAttempt.run('att2', 'e1', 's2', 'Budi', '1002', 'submitted', iso(-40), iso(20),
    JSON.stringify({ q1: 'A', q2: 'B', q3: 'C', q4: 'D' }), 100, 4, 0, 100, 'graded',
    JSON.stringify({ tabSwitch: 0, windowBlur: 0, fullscreenExit: 0 }), iso(-5), 'student');
  // att3: s1 mengerjakan paket warisan e3 (1 PG benar dari 2 PG + esai terisi).
  addAttempt.run('att3', 'e3', 's1', 'Andi', '1001', 'in_progress', iso(-5), iso(55), '{}', 0, 0, 0, null, null,
    JSON.stringify({ tabSwitch: 0, windowBlur: 0, fullscreenExit: 0 }), null, 'student');
  db.run('INSERT INTO cbt_attempt_answers (attempt_id, answers_json, doubtful_json) VALUES (?, ?, ?)',
    'att3', JSON.stringify({ p1: 'A', p2: 'A', es1: 'Jawaban esai siswa' }), '{}');
  // att4: s3 attempt e4 yang jendelanya sudah lewat (expired semu).
  addAttempt.run('att4', 'e4', 's3', 'Citra', '1003', 'in_progress', iso(-120), iso(-60), '{}', 0, 0, 0, null, null,
    JSON.stringify({ tabSwitch: 0, windowBlur: 0, fullscreenExit: 0 }), null, 'student');
  // att5: s4 attempt berjalan di ujian kelas lain (e2).
  addAttempt.run('att5', 'e2', 's4', 'Dodi', '1004', 'in_progress', iso(-3), iso(57), '{}', 0, 0, 0, null, null,
    JSON.stringify({ tabSwitch: 0, windowBlur: 0, fullscreenExit: 0 }), null, 'student');
  return db;
}

function getMonitor(db: TestD1Database, user: AuthUser | null, examId: string) {
  return monitorGet({ env: { DB: db as unknown as D1Database }, data: { user }, params: { id: examId }, request: new Request(`https://local/api/cbt/exams/${examId}/monitor`) } as any);
}

function postAction(db: TestD1Database, user: AuthUser | null, examId: string, body: object) {
  return monitorAction({ env: { DB: db as unknown as D1Database }, data: { user }, params: { id: examId }, request: new Request(`https://local/api/cbt/exams/${examId}/monitor/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) } as any);
}

function getNotices(db: TestD1Database, user: AuthUser | null, attemptId: string) {
  return noticesGet({ env: { DB: db as unknown as D1Database }, data: { user }, params: { id: attemptId }, request: new Request(`https://local/api/cbt/attempts/${attemptId}/notices`) } as any);
}

describe('Ruang Kontrol CBT — otorisasi monitor', () => {
  it('pemilik ujian boleh, admin boleh', async () => {
    const db = seed();
    expect((await getMonitor(db, guru, 'e1')).status).toBe(200);
    expect((await getMonitor(db, admin, 'e1')).status).toBe(200);
  });

  it('guru lain dan siswa ditolak; ujian tak dikenal 404', async () => {
    const db = seed();
    expect((await getMonitor(db, guruLain, 'e1')).status).toBe(403);
    expect((await getMonitor(db, siswa1, 'e1')).status).toBe(403);
    expect((await getMonitor(db, null, 'e1')).status).toBe(401);
    expect((await getMonitor(db, guru, 'tidak-ada')).status).toBe(404);
  });

  it('aksi kendali juga hanya untuk pengelola ujian', async () => {
    const db = seed();
    const response = await postAction(db, guruLain, 'e1', { action: 'announcement', message: 'Halo' });
    expect(response.status).toBe(403);
    const studentResponse = await postAction(db, siswa1, 'e1', { action: 'announcement', message: 'Halo' });
    expect(studentResponse.status).toBe(403);
  });
});

describe('Ruang Kontrol CBT — roster, progres & nilai sementara', () => {
  it('roster memuat siswa belum mulai dan mengecualikan kelas lain / nonaktif', async () => {
    const db = seed();
    const payload = await (await getMonitor(db, guru, 'e1')).json() as any;
    const names = payload.data.students.map((row: any) => row.name);
    expect(names).toEqual(['Andi', 'Budi', 'Citra']);
    const citra = payload.data.students.find((row: any) => row.name === 'Citra');
    expect(citra.status).toBe('not_started');
    expect(citra.answeredCount).toBe(0);
    expect(payload.data.summary).toMatchObject({ totalStudents: 3, notStarted: 1, inProgress: 1, submitted: 1, expired: 0, flagged: 1 });
  });

  it('nilai sementara dihitung server dari autosave vs kunci PG (kunci asal soal teracak)', async () => {
    const db = seed();
    const payload = await (await getMonitor(db, guru, 'e1')).json() as any;
    const andi = payload.data.students.find((row: any) => row.name === 'Andi');
    // Autosave {q1:A✓, q2:B✓, q3:A✗} dari 4 soal → 3 terjawab, progres 75%, PG 50.
    expect(andi.status).toBe('in_progress');
    expect(andi.answeredCount).toBe(3);
    expect(andi.progressPercent).toBe(75);
    expect(andi.provisionalScore).toBe(50);
    expect(andi.finalScore).toBeNull();
    expect(andi.remainingSeconds).toBeGreaterThan(2900);
    expect(andi.flagged).toBe(true);
    expect(andi.proctor).toEqual({ tabSwitch: 4, windowBlur: 1, fullscreenExit: 0 });
    const budi = payload.data.students.find((row: any) => row.name === 'Budi');
    expect(budi.status).toBe('submitted');
    expect(budi.finalScore).toBe(100);
    expect(budi.answeredCount).toBe(4);
  });

  it('respons monitor TIDAK pernah memuat kunci jawaban / pembahasan', async () => {
    const db = seed();
    const raw = JSON.stringify(await (await getMonitor(db, guru, 'e1')).json());
    expect(raw).not.toContain('correctAnswer');
    expect(raw).not.toContain('Pembahasan rahasia');
  });

  it('paket warisan ber-esai: nilai sementara hanya bagian PG + tanda esai pending', async () => {
    const db = seed();
    const payload = await (await getMonitor(db, guru, 'e3')).json() as any;
    const andi = payload.data.students.find((row: any) => row.name === 'Andi');
    // 1 PG benar dari total 3 soal → PG sementara 33.3; esai terisi → terjawab 3.
    expect(andi.provisionalScore).toBe(33.3);
    expect(andi.answeredCount).toBe(3);
    expect(andi.hasEssayPending).toBe(true);
  });
});

describe('Ruang Kontrol CBT — tambah waktu', () => {
  it('memperpanjang expires_at attempt berjalan dan tercatat di audit', async () => {
    const db = seed();
    const before = db.get<{ expires_at: string }>('SELECT expires_at FROM cbt_attempts WHERE id=?', 'att1')!;
    const response = await postAction(db, guru, 'e1', { action: 'extend_time', attemptId: 'att1', minutes: 10 });
    expect(response.status).toBe(200);
    const after = db.get<{ expires_at: string }>('SELECT expires_at FROM cbt_attempts WHERE id=?', 'att1')!;
    expect(new Date(after.expires_at).getTime() - new Date(before.expires_at).getTime()).toBe(10 * 60_000);
    const audit = db.get<any>("SELECT * FROM cbt_monitor_actions WHERE action='extend_time' AND attempt_id='att1'");
    expect(audit).toBeTruthy();
    expect(audit.actor_user_id).toBe('g1');
    expect(JSON.parse(audit.detail_json).minutes).toBe(10);
  });

  it('opsi semua-yang-berjalan memperpanjang seluruh attempt in_progress ujian itu saja', async () => {
    const db = seed();
    const response = await postAction(db, guru, 'e3', { action: 'extend_time', minutes: 5 });
    const payload = await response.json() as any;
    expect(payload.data.extended).toHaveLength(1);
    expect(payload.data.extended[0].attemptId).toBe('att3');
    // Attempt ujian lain tidak tersentuh.
    const other = db.get<{ expires_at: string }>('SELECT expires_at FROM cbt_attempts WHERE id=?', 'att1')!;
    expect(new Date(other.expires_at).getTime()).toBeLessThan(Date.now() + 51 * 60_000);
  });

  it('menit di luar pilihan 5/10/15 ditolak; attempt yang sudah kumpul ditolak', async () => {
    const db = seed();
    expect((await postAction(db, guru, 'e1', { action: 'extend_time', attemptId: 'att1', minutes: 7 })).status).toBe(400);
    expect((await postAction(db, guru, 'e1', { action: 'extend_time', attemptId: 'att2', minutes: 5 })).status).toBe(409);
  });
});

describe('Ruang Kontrol CBT — paksa kumpul', () => {
  it('menilai dari autosave lewat jalur resmi, berpenanda pengawas, dan tercatat audit', async () => {
    const db = seed();
    // Nilai sementara sebelum paksa kumpul = 50; final harus sama (jawaban tak berubah).
    const before = await (await getMonitor(db, guru, 'e1')).json() as any;
    const provisional = before.data.students.find((row: any) => row.name === 'Andi').provisionalScore;
    const response = await postAction(db, guru, 'e1', { action: 'force_submit', attemptId: 'att1' });
    expect(response.status).toBe(200);
    const payload = await response.json() as any;
    expect(payload.data.score).toBe(provisional);
    expect(payload.data.submittedBy).toBe('proctor');
    const row = db.get<any>('SELECT status, score, submitted_by FROM cbt_attempts WHERE id=?', 'att1');
    expect(row).toMatchObject({ status: 'submitted', score: 50, submitted_by: 'proctor' });
    const audit = db.get<any>("SELECT * FROM cbt_monitor_actions WHERE action='force_submit' AND attempt_id='att1'");
    expect(audit).toBeTruthy();
    // Monitor sesudahnya menampilkan penanda oleh pengawas.
    const after = await (await getMonitor(db, guru, 'e1')).json() as any;
    const andi = after.data.students.find((row: any) => row.name === 'Andi');
    expect(andi.status).toBe('submitted');
    expect(andi.submittedBy).toBe('proctor');
    expect(andi.finalScore).toBe(50);
  });

  it('mengabaikan aturan waktu minimal kirim (wewenang pengawas)', async () => {
    const db = seed();
    db.run("UPDATE cbt_exams SET exam_type='ujian', min_submit_minutes=30 WHERE id='e1'");
    // Attempt baru berjalan 10 menit (< 30) — submit siswa akan ditolak, paksa kumpul tetap bisa.
    const response = await postAction(db, guru, 'e1', { action: 'force_submit', attemptId: 'att1' });
    expect(response.status).toBe(200);
  });

  it('menolak attempt yang sudah kedaluwarsa dan yang sudah kumpul', async () => {
    const db = seed();
    const expired = await postAction(db, guru, 'e4', { action: 'force_submit', attemptId: 'att4' });
    expect(expired.status).toBe(409);
    expect((await expired.json() as any).error).toContain('kedaluwarsa');
    expect((await postAction(db, guru, 'e1', { action: 'force_submit', attemptId: 'att2' })).status).toBe(409);
  });

  it('paket warisan: paksa kumpul masuk pending_grading (esai menunggu koreksi guru)', async () => {
    const db = seed();
    const response = await postAction(db, guru, 'e3', { action: 'force_submit', attemptId: 'att3' });
    const payload = await response.json() as any;
    expect(payload.data.gradingStatus).toBe('pending_grading');
    expect(payload.data.pgScore).toBe(33.3);
    const row = db.get<any>('SELECT status, grading_status FROM cbt_attempts WHERE id=?', 'att3');
    expect(row).toMatchObject({ status: 'submitted', grading_status: 'pending_grading' });
  });
});

describe('Ruang Kontrol CBT — pengumuman & notices siswa', () => {
  it('pengumuman tersimpan tersanitasi, teraudit, dan terkirim ke notices pemilik attempt', async () => {
    const db = seed();
    const response = await postAction(db, guru, 'e1', { action: 'announcement', message: '  <b>Perhatian</b>   semua siswa!  ' });
    expect(response.status).toBe(200);
    const stored = db.get<any>('SELECT message FROM cbt_exam_announcements WHERE exam_id=?', 'e1');
    expect(stored.message).toBe('Perhatian semua siswa!');
    expect(db.get<any>("SELECT * FROM cbt_monitor_actions WHERE action='announcement' AND exam_id='e1'")).toBeTruthy();

    const notices = await (await getNotices(db, siswa1, 'att1')).json() as any;
    expect(notices.data.status).toBe('in_progress');
    expect(notices.data.announcements).toHaveLength(1);
    expect(notices.data.announcements[0].message).toBe('Perhatian semua siswa!');
    expect(notices.data.expiresAt).toBe(db.get<{ expires_at: string }>('SELECT expires_at FROM cbt_attempts WHERE id=?', 'att1')!.expires_at);
  });

  it('pengumuman ujian lain TIDAK terkirim; pesan >300 karakter ditolak', async () => {
    const db = seed();
    await postAction(db, guru, 'e1', { action: 'announcement', message: 'Khusus kelas X' });
    const noticesOther = await (await getNotices(db, makeUser({ id: 's4', name: 'Dodi', role: 'siswa', classId: 'k2' }), 'att5')).json() as any;
    expect(noticesOther.data.announcements).toHaveLength(0);
    const tooLong = await postAction(db, guru, 'e1', { action: 'announcement', message: 'x'.repeat(301) });
    expect(tooLong.status).toBe(400);
  });

  it('siswa tidak bisa membaca notices attempt orang lain', async () => {
    const db = seed();
    expect((await getNotices(db, siswa2, 'att1')).status).toBe(404);
    expect((await getNotices(db, guru, 'att1')).status).toBe(403);
    expect((await getNotices(db, siswa1, 'att1')).status).toBe(200);
  });

  it('notices melaporkan paksa kumpul: status submitted + submittedBy proctor', async () => {
    const db = seed();
    await postAction(db, guru, 'e1', { action: 'force_submit', attemptId: 'att1' });
    const notices = await (await getNotices(db, siswa1, 'att1')).json() as any;
    expect(notices.data.status).toBe('submitted');
    expect(notices.data.submittedBy).toBe('proctor');
    expect(notices.data.score).toBe(50);
  });
});
