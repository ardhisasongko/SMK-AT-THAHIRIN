import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RaporPrintSheet } from '../src/components/RaporPrintSheet';
import { RaporModal } from '../src/components/RaporModal';
import type { RaporReport } from '../src/types';

const reportPenuh: RaporReport = {
  siswa: { nisn: '0068123491', name: 'Muhammad Rizky Pratama', classId: 'k1', className: 'X MPLB 1' },
  presensi: {
    rincian: [
      { status: 'Hadir', jumlah: 41 },
      { status: 'Terlambat', jumlah: 2 },
      { status: 'Sakit', jumlah: 1 },
      { status: 'Izin', jumlah: 3 },
      { status: 'Alpa', jumlah: 0 },
    ],
    total: 47,
    hadirPersen: 91,
  },
  cbt: {
    perMapel: [
      { subject: 'Kearsipan Digital', examCount: 3, avgScore: 86, bestScore: 90 },
      { subject: 'Bahasa Inggris', examCount: 2, avgScore: 78, bestScore: 85 },
    ],
    totalUjian: 5,
    rataRata: 83,
  },
  ujian: [
    { title: 'PTS Kearsipan Digital', subject: 'Kearsipan Digital', examType: 'ujian', score: 88, submittedAt: '2026-10-20T08:30:00.000Z' },
    { title: 'Latihan Korespondensi Bisnis', subject: 'Bahasa Inggris', examType: 'latihan', score: 81, submittedAt: '2026-10-18T09:15:00.000Z' },
  ],
};

const reportKosong: RaporReport = {
  siswa: { nisn: '0068999888', name: 'Siswa Baru', classId: 'k1', className: 'X MPLB 1' },
  presensi: {
    rincian: [
      { status: 'Hadir', jumlah: 0 },
      { status: 'Terlambat', jumlah: 0 },
      { status: 'Sakit', jumlah: 0 },
      { status: 'Izin', jumlah: 0 },
      { status: 'Alpa', jumlah: 0 },
    ],
    total: 0,
    hadirPersen: 0,
  },
  cbt: { perMapel: [], totalUjian: 0, rataRata: 0 },
  ujian: [],
};

describe('RaporPrintSheet — lembar cetak rapor', () => {
  it('menampilkan semua bagian dan angka rapor dari fixture JSON', () => {
    render(<RaporPrintSheet report={reportPenuh} />);

    expect(screen.getByTestId('rapor-print-sheet')).toBeInTheDocument();
    // Kop + identitas
    expect(screen.getByText('RAPOR')).toBeInTheDocument();
    expect(screen.getByText('SMK PLUS AT-THAHIRIN')).toBeInTheDocument();
    expect(screen.getByText(/0068123491/)).toBeInTheDocument();
    expect(screen.getByText(/Muhammad Rizky Pratama/)).toBeInTheDocument();
    expect(screen.getByText(/X MPLB 1/)).toBeInTheDocument();

    // Presensi: 5 status + jumlah + persentase kehadiran
    expect(screen.getByText('PRESENSI')).toBeInTheDocument();
    for (const status of ['Hadir', 'Terlambat', 'Sakit', 'Izin', 'Alpa']) {
      expect(screen.getByText(status)).toBeInTheDocument();
    }
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();

    // Nilai per mapel: mapel, rata-rata, nilai terbaik
    expect(screen.getByText('NILAI CBT PER MATA PELAJARAN')).toBeInTheDocument();
    expect(screen.getAllByText('Kearsipan Digital').length).toBeGreaterThan(0);
    expect(screen.getByText('86')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();

    // Riwayat ujian: judul, tanggal, jenis, skor
    expect(screen.getByText('RIWAYAT UJIAN')).toBeInTheDocument();
    expect(screen.getByText('PTS Kearsipan Digital')).toBeInTheDocument();
    expect(screen.getByText('Latihan Korespondensi Bisnis')).toBeInTheDocument();
    expect(screen.getByText('2026-10-20')).toBeInTheDocument();
    expect(screen.getByText('2026-10-18')).toBeInTheDocument();
    expect(screen.getAllByText('Ujian').length).toBe(2); // judul kolom + jenis ujian pertama
    expect(screen.getByText('Latihan')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('81')).toBeInTheDocument();

    // Rata-rata besar + blok tanda tangan (tempat dari konfigurasi + tanggal hari ini)
    expect(screen.getByText('RATA-RATA NILAI')).toBeInTheDocument();
    expect(screen.getByText('83')).toBeInTheDocument();
    const tanggalHariIni = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    expect(screen.getByText(`Megamendung, ${tanggalHariIni}`)).toBeInTheDocument();
    expect(screen.getByText('Wali Kelas,')).toBeInTheDocument();
  });

  it('menangani keadaan kosong dengan anggun', () => {
    render(<RaporPrintSheet report={reportKosong} />);

    // Presensi nol semua tetap tampil sebagai angka 0 dan 0%
    expect(screen.getAllByText('0').length).toBe(5);
    expect(screen.getByText('0%')).toBeInTheDocument();

    // Nilai kosong: catatan sopan + rata-rata tampil sebagai tanda pisah, bukan 0/NaN
    expect(screen.getByText('Belum ada nilai CBT yang final.')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    // Riwayat kosong: bagian dan tabelnya tidak dirender sama sekali
    expect(screen.queryByText('RIWAYAT UJIAN')).toBeNull();
  });
});

describe('RaporModal — tombol Cetak Rapor', () => {
  const fetchMock = vi.fn();
  let printSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ success: true, data: reportPenuh }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.classList.remove('printing-rapor');
  });

  it('menampilkan tombol Cetak Rapor dan memanggil window.print saat diklik', async () => {
    render(<RaporModal nisn="0068123491" name="Muhammad Rizky Pratama" onClose={() => {}} />);

    const button = await screen.findByRole('button', { name: /Cetak Rapor/ });
    expect(button).toBeInTheDocument();
    // Lembar cetak ikut dirender (tersembunyi di layar, khusus hasil cetak).
    expect(screen.getByTestId('rapor-print-sheet')).toBeInTheDocument();

    fireEvent.click(button);
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains('printing-rapor')).toBe(true);
  });
});
