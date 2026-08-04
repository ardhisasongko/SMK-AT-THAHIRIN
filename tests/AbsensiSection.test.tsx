import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AbsensiSection } from '../src/components/AbsensiSection';
import type { PresensiRecord, Siswa, Kelas, User } from '../src/types';

vi.mock('../src/utils/photo', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('/api/photo/test-1'),
}));

vi.mock('../src/utils/geo', () => ({
  getCurrentLocation: vi.fn().mockResolvedValue({ lat: -6.9, lng: 107.6 }),
  mapsUrl: (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`,
}));

const kelasList: Kelas[] = [
  {
    id: 'x-rpl-1', name: 'X RPL 1', jurusanCode: 'rpl', tingkat: 'X', ruang: 'R.1',
    waliKelas: 'Pak Guru', jumlahSiswa: 2, jadwal: [],
  },
];

const siswaList: Siswa[] = [
  { id: 's1', nisn: '0081234567', name: 'Budi', classId: 'x-rpl-1', gender: 'L', foto: '/img/budi.jpg' },
  { id: 's2', nisn: '0081234568', name: 'Andi', classId: 'x-rpl-1', gender: 'P', foto: '/img/andi.jpg' },
];

const ketuaUser: User = {
  id: 'k1', name: 'Ketua', email: 'ketua@test.com', role: 'ketua_kelas', avatar: '',
  classId: 'x-rpl-1', ketuaStatus: 'approved',
};

const adminUser: User = {
  id: 'a1', name: 'Admin', email: 'admin@test.com', role: 'admin', avatar: '',
};

const today = new Date().toISOString().split('T')[0];
const presensiList: PresensiRecord[] = [
  {
    id: 'p1', tanggal: today, classId: 'x-rpl-1', siswaId: 's1',
    siswaName: 'Budi', nisn: '0081234567', status: 'Hadir', waktuInput: '07:30:00',
    inputBy: { id: 'k1', name: 'Ketua', role: 'ketua_kelas' },
  },
];

function renderAbsensi(user: User) {
  return render(
    <AbsensiSection
      presensiList={presensiList}
      setPresensiList={vi.fn()}
      kelasList={kelasList}
      siswaList={siswaList}
      currentUser={user}
    />
  );
}

describe('AbsensiSection — view Ketua Kelas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ketua tidak melihat tab Scan QR / NISN', () => {
    renderAbsensi(ketuaUser);
    expect(screen.queryByText('Scan QR / NISN')).not.toBeInTheDocument();
  });

  it('ketua tidak melihat tab Rekap & Laporan', () => {
    renderAbsensi(ketuaUser);
    expect(screen.queryByText('Rekap & Laporan')).not.toBeInTheDocument();
  });

  it('ketua melihat tab Presensi Harian', () => {
    renderAbsensi(ketuaUser);
    expect(screen.getByText('Presensi Harian')).toBeInTheDocument();
  });

  it('ketua tidak melihat tombol "Tandai Semua Hadir"', () => {
    renderAbsensi(ketuaUser);
    expect(screen.queryByText('Tandai Semua Hadir')).not.toBeInTheDocument();
  });

  it('ketua melihat nama kelas statis, bukan dropdown pilih kelas', () => {
    renderAbsensi(ketuaUser);
    expect(screen.getByText('X RPL 1')).toBeInTheDocument();
    expect(screen.queryByText('Pilih Kelas:')).not.toBeInTheDocument();
  });

  it('ketua melihat daftar siswa di kelasnya (kartu & tabel)', () => {
    renderAbsensi(ketuaUser);
    expect(screen.getAllByText('Budi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Andi').length).toBeGreaterThan(0);
  });

  it('ketua melihat badge status Hadir untuk siswa yang sudah input', () => {
    renderAbsensi(ketuaUser);
    const badges = screen.getAllByText('Hadir');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('ketua melihat kolom Diinput oleh dengan nama penginput', () => {
    renderAbsensi(ketuaUser);
    expect(screen.getByText('Ketua')).toBeInTheDocument();
  });

  it('ketua melihat statistik kehadiran (Sakit, Izin, Alpa)', () => {
    renderAbsensi(ketuaUser);
    expect(screen.getByText('Sakit')).toBeInTheDocument();
    expect(screen.getByText('Izin')).toBeInTheDocument();
    expect(screen.getByText('Alpa')).toBeInTheDocument();
  });
});

describe('AbsensiSection — view Admin tetap lengkap', () => {
  it('admin masih melihat tab Scan QR / NISN dan Rekap & Laporan', () => {
    renderAbsensi(adminUser);
    expect(screen.getByText('Scan QR / NISN')).toBeInTheDocument();
    expect(screen.getByText('Rekap & Laporan')).toBeInTheDocument();
  });
});
