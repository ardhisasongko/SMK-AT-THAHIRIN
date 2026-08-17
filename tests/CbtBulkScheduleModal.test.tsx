import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CbtBulkScheduleModal } from '../src/components/cbt/CbtBulkScheduleModal';
import { cbtApi } from '../src/utils/cbt-api';
import type { Kelas } from '../src/types';

const kelas: Kelas = {
  id: 'k1', name: 'X MPLB 1', jurusanCode: 'MPLB', tingkat: 'X', ruang: 'R1', waliKelas: 'Guru', jumlahSiswa: 30, jadwal: [],
};

vi.mock('../src/utils/cbt-api', () => ({
  cbtApi: {
    createBulkExams: vi.fn(),
  },
}));

describe('CbtBulkScheduleModal', () => {
  it('menampilkan form template dan pratinjau jadwal', () => {
    render(<CbtBulkScheduleModal kelasList={[kelas]} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByText('Template Jadwal PTS/UAS (5 Hari × 4 Mapel)')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Mata pelajaran')).toHaveLength(4);
    fireEvent.change(screen.getByPlaceholderText('Contoh: PTS Ganjil 2026/2027'), { target: { value: 'PTS Ganjil' } });
    fireEvent.change(screen.getByLabelText('Mulai (Senin)'), { target: { value: '2026-09-14' } });
    expect(screen.getByText(/Pratinjau Jadwal/)).toBeInTheDocument();
  });

  it('mengirim payload dan menampilkan hasil dengan token', async () => {
    vi.mocked(cbtApi.createBulkExams).mockResolvedValue({
      title: 'PTS Ganjil',
      exams: [
        { id: 'e1', date: '2026-09-14', day: 'Senin', subject: 'Kearsipan', openTime: '07:30', closeTime: '09:00', token: 'ABCD1234', startDate: '2026-09-14' },
      ],
    });
    const onCreated = vi.fn();
    render(<CbtBulkScheduleModal kelasList={[kelas]} onClose={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(screen.getByPlaceholderText('Contoh: PTS Ganjil 2026/2027'), { target: { value: 'PTS Ganjil' } });
    fireEvent.change(screen.getByLabelText('Mulai (Senin)'), { target: { value: '2026-09-14' } });
    fireEvent.change(screen.getAllByPlaceholderText('Mata pelajaran')[0], { target: { value: 'Kearsipan' } });
    fireEvent.click(screen.getByRole('button', { name: /Buat 5 Ujian Sekaligus/ }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(await screen.findByText('1 ujian berhasil dibuat: PTS Ganjil')).toBeInTheDocument();
    expect(screen.getByText('ABCD1234')).toBeInTheDocument();
  });

  it('menampilkan error saat validasi gagal di client', () => {
    render(<CbtBulkScheduleModal kelasList={[kelas]} onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Buat 0 Ujian Sekaligus/ }));
    expect(screen.getByText('Nama periode wajib diisi.')).toBeInTheDocument();
  });
});