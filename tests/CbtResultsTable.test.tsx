import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CbtResultsTable } from '../src/components/cbt/CbtResultsTable';
import type { CbtExam, CbtSubmission } from '../src/types';

const exam: CbtExam = {
  id: 'c1',
  title: 'Ujian Kearsipan',
  subject: 'Kearsipan Digital',
  classTarget: 'X AP 1',
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
    submittedAt: '4 Agustus 2026',
    timeSpentSeconds: 900,
  },
];

describe('CbtResultsTable', () => {
  it('menampilkan data siswa dan nilai', () => {
    render(<CbtResultsTable submissions={submissions} exams={[exam]} onReview={vi.fn()} />);
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument();
    expect(screen.getByText('80 / 100')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Ujian Kearsipan')).toBeInTheDocument();
  });

  it('memanggil onReview saat tombol detail diklik', () => {
    const onReview = vi.fn();
    render(<CbtResultsTable submissions={submissions} exams={[exam]} onReview={onReview} />);
    fireEvent.click(screen.getByRole('button', { name: /Lihat Jawaban/ }));
    expect(onReview).toHaveBeenCalledWith(submissions[0]);
  });

  it('menampilkan empty state saat belum ada pengerjaan', () => {
    render(<CbtResultsTable submissions={[]} exams={[exam]} onReview={vi.fn()} />);
    expect(screen.getByText('Belum ada hasil pengerjaan ujian siswa.')).toBeInTheDocument();
  });
});
