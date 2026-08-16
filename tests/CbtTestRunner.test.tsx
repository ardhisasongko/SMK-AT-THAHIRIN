import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CbtTestRunner } from '../src/components/cbt/CbtTestRunner';
import type { CbtExam, User } from '../src/types';

const fetchMock = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { attemptId: 'a1', savedAt: 'x' } }) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  render(<CbtTestRunner exam={exam} currentUser={user} attemptId="a1" onFinish={onFinish} />);
  return { onFinish };
}

describe('CbtTestRunner', () => {
  it('menampilkan soal pertama dan judul ujian', () => {
    renderRunner();
    const title = screen.getByText('Ujian Kearsipan');
    expect(title).toBeInTheDocument();
    expect(title.parentElement).toHaveClass('min-w-0');
    expect(screen.getByText('Selesaikan')).toHaveClass('hidden', 'sm:inline');
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

  it('menyimpan jawaban ke localStorage tanpa request jaringan per soal', () => {
    renderRunner();
    fireEvent.click(screen.getByRole('button', { name: /Pilihan A/ }));
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pilihan B2/ }));

    const cached = JSON.parse(window.localStorage.getItem('cbt_answers_a1') || '{}');
    expect(cached.answers).toEqual({ q1: 'A', q2: 'B' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('menolak submit selama ada soal belum diisi dan tidak memanggil onFinish', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onFinish } = renderRunner();
    fireEvent.click(screen.getByRole('button', { name: /Pilihan A/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan' }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('1 soal belum diisi'));
    expect(screen.queryByText('Selesaikan Ujian CBT?')).not.toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('submit menghitung skor dan memanggil onFinish setelah semua soal diisi', async () => {
    const { onFinish } = renderRunner();
    fireEvent.click(screen.getByRole('button', { name: /Pilihan A/ }));
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pilihan B2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan' }));
    expect(screen.getByText('Selesaikan Ujian CBT?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Selesaikan Ujian' }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    const sub = onFinish.mock.calls[0][0];
    expect(sub.examId).toBe('c1');
    expect(sub.siswaId).toBe('u3');
    expect(sub.score).toBe(100); // 2 benar dari 2 soal
    expect(sub.correctCount).toBe(2);
    expect(sub.wrongCount).toBe(0);
    await waitFor(() => expect(window.localStorage.getItem('cbt_answers_a1')).toBeNull());
  });
});

describe('CbtTestRunner ujian resmi (waktu minimal kirim)', () => {
  it('menonaktifkan tombol kirim sebelum waktu minimal pengerjaan', () => {
    const ujianExam: CbtExam = { ...exam, examType: 'ujian', minSubmitMinutes: exam.durationMinutes };
    const onFinish = vi.fn();
    render(<CbtTestRunner exam={ujianExam} currentUser={user} attemptId="a1" onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: /Pilihan A/ }));
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pilihan B2/ }));

    const bottomBtn = screen.getByRole('button', { name: /Kirim dibuka dalam/ });
    expect(bottomBtn).toBeDisabled();
    fireEvent.click(bottomBtn);
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.queryByText('Selesaikan Ujian CBT?')).not.toBeInTheDocument();
  });

  it('memblokir klik Selesaikan di header sebelum waktu minimal', () => {
    const ujianExam: CbtExam = { ...exam, examType: 'ujian', minSubmitMinutes: exam.durationMinutes };
    render(<CbtTestRunner exam={ujianExam} currentUser={user} attemptId="a1" onFinish={vi.fn()} />);
    const headerBtn = screen.getByRole('button', { name: /^[0-9]+:[0-9]{2}$/ });
    expect(headerBtn).toBeDisabled();
  });

  it('tetap bisa mengirim kapan saja untuk ujian latihan', () => {
    renderRunner();
    fireEvent.click(screen.getByRole('button', { name: /Pilihan A/ }));
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pilihan B2/ }));
    const btn = screen.getByRole('button', { name: 'Selesaikan Ujian' });
    expect(btn).not.toBeDisabled();
  });
});

describe('CbtTestRunner soal essai', () => {
  const essayExam: CbtExam = {
    ...exam,
    id: 'c2',
    questions: [
      {
        id: 'e1',
        question: 'Apa itu arsip?',
        type: 'essai',
        options: [],
        correctAnswer: 'rekaman kegiatan',
      },
      {
        id: 'p1',
        question: 'Arsip dinamis bersifat?',
        options: [
          { key: 'A', text: 'Pilihan A' },
          { key: 'B', text: 'Pilihan B' },
        ],
        correctAnswer: 'A',
      },
    ],
  };

  function renderEssayRunner(onFinish = vi.fn()) {
    render(<CbtTestRunner exam={essayExam} currentUser={user} attemptId="a2" onFinish={onFinish} />);
    return { onFinish };
  }

  it('menampilkan textarea untuk soal essai dan menolak submit saat essai kosong', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onFinish } = renderEssayRunner();
    expect(screen.getByText('Soal Essai')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tulis jawaban essai Anda di sini...')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Tulis jawaban essai Anda di sini...'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan' }));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('2 soal belum diisi'));
    expect(onFinish).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('submit sukses saat PG dan essai terisi, lalu cache lokal dihapus', async () => {
    const { onFinish } = renderEssayRunner();
    fireEvent.change(screen.getByPlaceholderText('Tulis jawaban essai Anda di sini...'), { target: { value: 'Arsip adalah rekaman kegiatan manusia.' } });
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pilihan A/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Selesaikan Ujian' }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    const sub = onFinish.mock.calls[0][0];
    expect(sub.answers.e1).toBe('Arsip adalah rekaman kegiatan manusia.');
    expect(sub.answers.p1).toBe('A');
    await waitFor(() => expect(window.localStorage.getItem('cbt_answers_a2')).toBeNull());
  });
});