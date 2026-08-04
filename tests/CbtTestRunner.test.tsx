import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CbtTestRunner } from '../src/components/cbt/CbtTestRunner';
import type { CbtExam, User } from '../src/types';

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
  questions: [
    {
      id: 'q1',
      question: 'Pertanyaan pertama?',
      options: [
        { key: 'A', text: 'Pilihan A' },
        { key: 'B', text: 'Pilihan B' },
      ],
      correctAnswer: 'A',
      explanation: 'Karena A benar.',
    },
    {
      id: 'q2',
      question: 'Pertanyaan kedua?',
      options: [
        { key: 'A', text: 'Pilihan A2' },
        { key: 'B', text: 'Pilihan B2' },
      ],
      correctAnswer: 'B',
      explanation: 'Karena B benar.',
    },
  ],
};

const user: User = {
  id: 'u3',
  name: 'Siswa',
  email: 'siswa@test.id',
  role: 'siswa',
  avatar: '',
  nipNisn: '0081234567',
  classId: 'k1',
};

function renderRunner(onFinish = vi.fn()) {
  render(<CbtTestRunner exam={exam} currentUser={user} onFinish={onFinish} />);
  return { onFinish };
}

describe('CbtTestRunner', () => {
  it('menampilkan soal pertama dan judul ujian', () => {
    renderRunner();
    expect(screen.getByText('Ujian Kearsipan')).toBeInTheDocument();
    expect(screen.getByText('Soal No. 1')).toBeInTheDocument();
    expect(screen.getByText('Pertanyaan pertama?')).toBeInTheDocument();
  });

  it('menandai soal yang sudah dijawab', () => {
    renderRunner();
    expect(screen.getByText('0 dijawab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pilihan A/ }));
    expect(screen.getByText('1 dijawab')).toBeInTheDocument();
  });

  it('navigasi ke soal berikutnya', () => {
    renderRunner();
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    expect(screen.getByText('Soal No. 2')).toBeInTheDocument();
    expect(screen.getByText('Pertanyaan kedua?')).toBeInTheDocument();
  });

  it('submit menghitung skor dan memanggil onFinish', () => {
    const { onFinish } = renderRunner();
    fireEvent.click(screen.getByRole('button', { name: /Pilihan A/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan' }));
    expect(screen.getByText('Selesaikan Ujian CBT?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Selesaikan Ujian' }));

    expect(onFinish).toHaveBeenCalledTimes(1);
    const sub = onFinish.mock.calls[0][0];
    expect(sub.examId).toBe('c1');
    expect(sub.siswaId).toBe('u3');
    expect(sub.score).toBe(50); // 1 benar dari 2 soal
    expect(sub.correctCount).toBe(1);
    expect(sub.wrongCount).toBe(1);
  });
});
