import { describe, expect, it } from 'vitest';
import { canManageCbtExam, hashCbtToken, scoreCbtAnswers, validateCbtExamInput } from '../functions/_lib/cbt';
import { notificationVisible } from '../functions/_lib/forum-notifications';
import type { AuthUser } from '../functions/_lib/auth';

const student: AuthUser = {
  id: 'u1', name: 'Siswa', email: 's@example.test', nipNisn: '123', nik: null,
  tanggalLahir: null, role: 'siswa', classId: 'k1', ketuaStatus: 'none', jabatan: null,
  status: 'active', mustChangePassword: false,
};

describe('CBT domain security', () => {
  it('normalizes tokens before hashing', async () => {
    expect(await hashCbtToken(' abCD12 ')).toBe(await hashCbtToken('ABCD12'));
  });

  it('calculates score exclusively from question keys and submitted answers', () => {
    expect(scoreCbtAnswers([
      { id: 'q1', correctAnswer: 'A' },
      { id: 'q2', correctAnswer: 'C' },
    ], { q1: 'A', q2: 'B' })).toEqual({ correctCount: 1, wrongCount: 1, score: 50 });
  });

  it('limits teachers to their own exams while admins retain oversight', () => {
    const teacher = { ...student, id: 'g1', name: 'Guru Satu', role: 'guru' } as AuthUser;
    const admin = { ...teacher, id: 'a1', role: 'admin' } as AuthUser;
    expect(canManageCbtExam(teacher, { teacher_user_id: 'g1', teacher_name: 'Guru Satu' })).toBe(true);
    expect(canManageCbtExam(teacher, { teacher_user_id: 'g2', teacher_name: 'Guru Dua' })).toBe(false);
    expect(canManageCbtExam(teacher, { teacher_user_id: null, teacher_name: 'Guru Satu' })).toBe(true);
    expect(canManageCbtExam(admin, { teacher_user_id: 'g2', teacher_name: 'Guru Dua' })).toBe(true);
  });

  it('requires subject, unique question IDs, and complete non-empty A-E options', () => {
    const valid = {
      title: 'Ujian', subject: 'Kearsipan', durationMinutes: 30, token: 'ABCD', startDate: '2026-08-15', endDate: '2026-08-16',
      questions: [{ id: 'q1', question: 'Pertanyaan?', correctAnswer: 'A', options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Opsi ${key}` })) }],
    };
    expect(validateCbtExamInput(valid)).toBeNull();
    expect(validateCbtExamInput({ ...valid, subject: ' ' })).toMatch(/Mata pelajaran/);
    expect(validateCbtExamInput({ ...valid, questions: [valid.questions[0], valid.questions[0]] })).toMatch(/ID unik/);
    expect(validateCbtExamInput({ ...valid, questions: [{ ...valid.questions[0], options: valid.questions[0].options.slice(0, 4) }] })).toMatch(/A-E lengkap/);
    expect(validateCbtExamInput({ ...valid, questions: [{ ...valid.questions[0], options: valid.questions[0].options.map(option => option.key === 'E' ? { ...option, text: ' ' } : option) }] })).toMatch(/berisi teks/);
    expect(validateCbtExamInput({ ...valid, endDate: '2026-02-30' })).toMatch(/tanggal/);
  });
});

describe('notification recipient isolation', () => {
  it('allows student notifications only for the matching class', () => {
    expect(notificationVisible(student, { target_role: 'siswa', target_class_id: 'k1' })).toBe(true);
    expect(notificationVisible(student, { target_role: 'siswa', target_class_id: 'k2' })).toBe(false);
    expect(notificationVisible(student, { target_role: 'admin', target_class_id: null })).toBe(false);
  });
});
