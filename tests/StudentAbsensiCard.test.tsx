import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudentAbsensiCard } from '../src/components/StudentAbsensiCard';
import type { PresensiRecord, Siswa, User } from '../src/types';

vi.mock('../src/utils/photo', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('/api/photo/test-1'),
}));

vi.mock('../src/utils/geo', () => ({
  getCurrentLocation: vi.fn().mockResolvedValue({ lat: -6.9, lng: 107.6 }),
  mapsUrl: (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`,
}));

const mockUser: User = {
  id: 's1',
  name: 'Budi',
  email: 'budi@test.com',
  role: 'siswa',
  avatar: '',
  nipNisn: '0081234567',
  classId: 'x-rpl-1',
};

const mockSiswa: Siswa[] = [
  { id: 's1', nisn: '0081234567', name: 'Budi', classId: 'x-rpl-1', gender: 'L', foto: '/img/budi.jpg' },
  { id: 's2', nisn: '0081234568', name: 'Andi', classId: 'x-rpl-1', gender: 'L', foto: '/img/andi.jpg' },
];

describe('StudentAbsensiCard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows empty state when no record today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:30:00Z')); // 07:30 WIB

    render(
      <StudentAbsensiCard
        presensiList={[]}
        setPresensiList={vi.fn()}
        siswaList={mockSiswa}
        currentUser={mockUser}
      />
    );

    expect(screen.getByText('Kehadiran Hari Ini')).toBeInTheDocument();
    expect(screen.getByText('Isi Presensi Sekarang')).toBeInTheDocument();
  });

  it('shows existing record when present', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:30:00Z')); // 07:30 WIB

    const today = '2026-08-04';
    const record: PresensiRecord = {
      id: 'p1',
      tanggal: today,
      classId: 'x-rpl-1',
      siswaId: 's1',
      siswaName: 'Budi',
      nisn: '0081234567',
      status: 'Hadir',
      waktuInput: '07:30:00',
    };

    render(
      <StudentAbsensiCard
        presensiList={[record]}
        setPresensiList={vi.fn()}
        siswaList={mockSiswa}
        currentUser={mockUser}
      />
    );

    expect(screen.getAllByText('Hadir').length).toBeGreaterThan(0);
    expect(screen.getByText('Edit Presensi')).toBeInTheDocument();
  });

  it('shows time restriction message after 08:00 WIB', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T01:30:00Z')); // 08:30 WIB

    const today = '2026-08-04';
    const record: PresensiRecord = {
      id: 'p1',
      tanggal: today,
      classId: 'x-rpl-1',
      siswaId: 's1',
      siswaName: 'Budi',
      nisn: '0081234567',
      status: 'Hadir',
      waktuInput: '07:30:00',
    };

    render(
      <StudentAbsensiCard
        presensiList={[record]}
        setPresensiList={vi.fn()}
        siswaList={mockSiswa}
        currentUser={mockUser}
      />
    );

    expect(screen.queryByText('Edit Presensi')).not.toBeInTheDocument();
    expect(screen.getByText(/Edit hanya bisa dilakukan sebelum jam 08:00 WIB/)).toBeInTheDocument();
  });

  it('shows expired message when no record and after 08:00 WIB', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T01:30:00Z')); // 08:30 WIB

    render(
      <StudentAbsensiCard
        presensiList={[]}
        setPresensiList={vi.fn()}
        siswaList={mockSiswa}
        currentUser={mockUser}
      />
    );

    expect(screen.queryByText('Isi Presensi Sekarang')).not.toBeInTheDocument();
    expect(screen.getByText(/Batas waktu input sudah lewat/)).toBeInTheDocument();
  });

  it('displays class attendance today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:30:00Z'));

    const today = '2026-08-04';
    const records: PresensiRecord[] = [
      {
        id: 'p1', tanggal: today, classId: 'x-rpl-1', siswaId: 's1',
        siswaName: 'Budi', nisn: '0081234567', status: 'Hadir', waktuInput: '07:30:00',
      },
    ];

    render(
      <StudentAbsensiCard
        presensiList={records}
        setPresensiList={vi.fn()}
        siswaList={mockSiswa}
        currentUser={mockUser}
      />
    );

    expect(screen.getByText('Kehadiran Kelas Hari Ini')).toBeInTheDocument();
    expect(screen.getByText('Budi')).toBeInTheDocument();
    expect(screen.getByText('Andi')).toBeInTheDocument();
  });

  it('opens edit modal when clicking Edit Presensi', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:30:00Z')); // 07:30 WIB

    const today = '2026-08-04';
    const record: PresensiRecord = {
      id: 'p1', tanggal: today, classId: 'x-rpl-1', siswaId: 's1',
      siswaName: 'Budi', nisn: '0081234567', status: 'Hadir', waktuInput: '07:30:00',
    };

    render(
      <StudentAbsensiCard
        presensiList={[record]}
        setPresensiList={vi.fn()}
        siswaList={mockSiswa}
        currentUser={mockUser}
      />
    );

    fireEvent.click(screen.getByText('Edit Presensi'));
    expect(screen.getByText('Edit Presensi', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('Simpan')).toBeInTheDocument();
  });

  it('opens input modal when clicking Isi Presensi', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:30:00Z')); // 07:30 WIB

    render(
      <StudentAbsensiCard
        presensiList={[]}
        setPresensiList={vi.fn()}
        siswaList={mockSiswa}
        currentUser={mockUser}
      />
    );

    fireEvent.click(screen.getByText('Isi Presensi Sekarang'));
    expect(screen.getByText('Input Presensi', { selector: 'h3' })).toBeInTheDocument();
  });

  it('renders history section', () => {
    render(
      <StudentAbsensiCard
        presensiList={[]}
        setPresensiList={vi.fn()}
        siswaList={mockSiswa}
        currentUser={mockUser}
      />
    );

    expect(screen.getByText('Riwayat Saya (14 Hari)')).toBeInTheDocument();
    expect(screen.getByText('Belum ada riwayat.')).toBeInTheDocument();
  });
});
