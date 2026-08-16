import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CbtCreateExamModal } from '../src/components/cbt/CbtCreateExamModal';
import type { User } from '../src/types';

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

describe('CbtCreateExamModal', () => {
  it('menambahkan soal manual', () => {
    renderModal();
    expect(screen.getByText('Daftar Soal Ujian (0 Soal)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manual (PG)' }));
    expect(screen.getByText('Daftar Soal Ujian (1 Soal)')).toBeInTheDocument();
    expect(screen.getByText('Soal #1')).toBeInTheDocument();
  });

  it('menolak simpan tanpa soal', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onSave } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('contoh: Penilaian Harian - Otomatisasi Kearsipan Digital'), {
      target: { value: 'Penilaian Harian Kearsipan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Ujian CBT' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Harap tambahkan minimal 1 soal ujian.');
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

  it('menambahkan soal essai dan wajib mengisi kunci jawaban', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onSave } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('contoh: Penilaian Harian - Otomatisasi Kearsipan Digital'), {
      target: { value: 'Penilaian Harian Kearsipan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan Essai' }));
    expect(screen.getByText('Daftar Soal Ujian (1 Soal)')).toBeInTheDocument();
    expect(screen.getByText('Essai')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Ujian CBT' }));
    expect(alertSpy).toHaveBeenCalledWith('Setiap soal essai wajib memiliki kunci jawaban teks.');
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('contoh: arsip adalah rekaman kegiatan|rekaman informasi'), { target: { value: 'rekaman kegiatan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Ujian CBT' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.questions[0]).toMatchObject({ type: 'essai', correctAnswer: 'rekaman kegiatan', options: [] });
    alertSpy.mockRestore();
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
