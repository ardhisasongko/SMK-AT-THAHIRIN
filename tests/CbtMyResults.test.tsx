import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CbtMyResults } from '../src/components/cbt/CbtMyResults';
import type { CbtExam, CbtSubmission } from '../src/types';

const exam: CbtExam = {
  id: 'c1',
  title: 'Ujian Kearsipan',
  subject: 'Kearsipan Digital',
  classTarget: 'X MPLB 1',
  durationMinutes: 30,
  token: 'AP1234',
  teacherName: 'Bpk. Guru',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
  questions: [],
};

const submissions: CbtSubmission[] = [
  {
    id: 'sub1',
    examId: 'c1',
    siswaId: 'u3',
    siswaName: 'Siti Nurhaliza',
    nisn: '0068123501',
    answers: {},
    score: 80,
    correctCount: 8,
    wrongCount: 2,
    submittedAt: '2026-08-16T06:13:01.445Z',
    timeSpentSeconds: 900,
  },
];

describe('CbtMyResults', () => {
  it('menampilkan riwayat nilai siswa', () => {
    render(<CbtMyResults submissions={submissions} exams={[exam]} onReview={vi.fn()} />);
    expect(screen.getByText('Nilai Saya (Riwayat Ujian)')).toBeInTheDocument();
    expect(screen.getByText('Kearsipan Digital')).toBeInTheDocument();
    expect(screen.getByText('Ujian Kearsipan')).toBeInTheDocument();
    expect(screen.getByText('80 / 100')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('memanggil onReview saat tombol detail diklik', () => {
    const onReview = vi.fn();
    render(<CbtMyResults submissions={submissions} exams={[exam]} onReview={onReview} />);
    fireEvent.click(screen.getByRole('button', { name: /Lihat Jawaban/ }));
    expect(onReview).toHaveBeenCalledWith(submissions[0]);
  });

  it('menampilkan empty state saat belum ada ujian dikerjakan', () => {
    render(<CbtMyResults submissions={[]} exams={[exam]} onReview={vi.fn()} />);
    expect(screen.getByText(/Belum ada ujian yang kamu kerjakan/)).toBeInTheDocument();
  });
});