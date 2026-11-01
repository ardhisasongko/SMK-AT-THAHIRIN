vi.mock('../src/components/ui/toast', () => ({ showToast: vi.fn() }));
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { showToast } from '../src/components/ui/toast';
import { CbtCreateExamModal } from '../src/components/cbt/CbtCreateExamModal';
import type { CbtExam, User } from '../src/types';

const guruUser: User = {
  id: 'u2',
  name: 'Bpk. Guru',
  email: 'guru@test.id',
  role: 'guru',
  avatar: '',
  nipNisn: '19890215 201502 1 003',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderModal(onSave = vi.fn(), onClose = vi.fn()) {
  render(<CbtCreateExamModal currentUser={guruUser} kelasList={[]} onSave={onSave} onClose={onClose} />);
  return { onSave, onClose };
}

const legacyExam: CbtExam = {
  id: 'cbt-legacy',
  title: 'Ujian Warisan Campuran',
  subject: 'Otomatisasi Kearsipan Digital',
  classTarget: 'all',
  durationMinutes: 30,
  token: '',
  teacherName: 'Bpk. Guru',
  startDate: '2026-08-15',
  endDate: '2026-08-16',
  status: 'active',
  examType: 'latihan',
  questions: [
    {
      id: 'q1', question: 'Pertanyaan PG warisan?', type: 'pg',
      options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key: key as 'A' | 'B' | 'C' | 'D' | 'E', text: `Opsi ${key}` })),
      correctAnswer: 'A',
    },
    { id: 'e1', question: 'Jelaskan pengertian arsip!', type: 'essai', options: [], correctAnswer: 'rekaman kegiatan' },
  ],
};

describe('CbtCreateExamModal', () => {
  it('menambahkan soal manual', () => {
    renderModal();
    expect(screen.getByText('Daftar Soal Ujian (0 Soal)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manual (PG)' }));
    expect(screen.getByText('Daftar Soal Ujian (1 Soal)')).toBeInTheDocument();
    expect(screen.getByText('Soal #1')).toBeInTheDocument();
  });

  it('menolak simpan tanpa soal', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('contoh: Penilaian Harian - Otomatisasi Kearsipan Digital'), {
      target: { value: 'Penilaian Harian Kearsipan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Ujian CBT' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Harap tambahkan minimal 1 soal ujian.', 'error');
  });

  it('menyimpan ujian baru dengan judul dan soal', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('contoh: Penilaian Harian - Otomatisasi Kearsipan Digital'), {
      target: { value: 'Penilaian Harian Kearsipan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Manual (PG)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Ujian CBT' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.title).toBe('Penilaian Harian Kearsipan');
    expect(saved.questions).toHaveLength(1);
    expect(saved.teacherName).toBe('Bpk. Guru');
  });

  it('tidak lagi menyediakan pembuatan soal essai', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: 'Tambahkan Essai' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Essai/)).not.toBeInTheDocument();
  });

  it('paket warisan: soal essai tampil sebagai warisan, tidak dapat diubah, dan dipertahankan apa adanya saat simpan', () => {
    const onSave = vi.fn();
    render(<CbtCreateExamModal currentUser={guruUser} kelasList={[]} initialExam={legacyExam} onSave={onSave} onClose={vi.fn()} />);
    expect(screen.getByText('Daftar Soal Ujian (2 Soal)')).toBeInTheDocument();
    expect(screen.getByText(/Esai \(warisan — tidak dapat dibuat baru\)/)).toBeInTheDocument();
    expect(screen.getByText('Jelaskan pengertian arsip!')).toBeInTheDocument();
    // Tidak ada kolom kunci essai yang dapat diubah untuk soal warisan.
    expect(screen.queryByPlaceholderText('contoh: arsip adalah rekaman kegiatan|rekaman informasi')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.questions).toHaveLength(2);
    expect(saved.questions[1]).toMatchObject({ id: 'e1', type: 'essai', question: 'Jelaskan pengertian arsip!', correctAnswer: 'rekaman kegiatan' });
  });

  it('paket warisan: soal essai dapat dihapus dari paket', () => {
    const onSave = vi.fn();
    render(<CbtCreateExamModal currentUser={guruUser} kelasList={[]} initialExam={legacyExam} onSave={onSave} onClose={vi.fn()} />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Hapus' });
    expect(deleteButtons).toHaveLength(2);
    fireEvent.click(deleteButtons[1]); // kartu kedua = esai warisan
    expect(screen.getByText('Daftar Soal Ujian (1 Soal)')).toBeInTheDocument();
    expect(screen.queryByText('Jelaskan pengertian arsip!')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].questions).toHaveLength(1);
    expect(onSave.mock.calls[0][0].questions[0].type).not.toBe('essai');
  });

  it('ujian resmi (UAS/UTS) otomatis mengisi waktu minimal kirim 80% durasi', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('contoh: Penilaian Harian - Otomatisasi Kearsipan Digital'), {
      target: { value: 'PTS Kearsipan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Manual (PG)' }));
    fireEvent.change(screen.getByLabelText('Jenis Ujian'), { target: { value: 'ujian' } });
    expect(screen.getByLabelText(/Waktu Minimal Kirim/)).toHaveValue(24); // 80% dari durasi default 30 menit
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Ujian CBT' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.examType).toBe('ujian');
    expect(saved.minSubmitMinutes).toBe(24);
  });
});
