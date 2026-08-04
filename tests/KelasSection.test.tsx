import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KelasSection } from '../src/components/KelasSection';
import type { Kelas, Siswa, User } from '../src/types';

const kelasList: Kelas[] = [
  {
    id: 'x-mplb-1', name: 'X MPLB 1', jurusanCode: 'MPLB', tingkat: 'X', ruang: 'Gedung A - R.101',
    waliKelas: 'Bpk. Guru', jumlahSiswa: 2, jadwal: [],
  },
];

const siswaList: Siswa[] = [
  { id: 's1', nisn: '0068123491', name: 'Rizky', classId: 'x-mplb-1', gender: 'L', foto: '/img/rizky.jpg' },
  { id: 's2', nisn: '0068123492', name: 'Adinda', classId: 'x-mplb-1', gender: 'P', foto: '/img/adinda.jpg' },
];

const guruUser: User = {
  id: 'u2', name: 'Bpk. Guru', email: 'guru@test.id', role: 'guru', avatar: '', nipNisn: '19890215',
};

function renderKelas(user: User) {
  return render(
    <KelasSection
      kelasList={kelasList}
      setKelasList={vi.fn()}
      siswaList={siswaList}
      setSiswaList={vi.fn()}
      currentUser={user}
    />
  );
}

describe('KelasSection', () => {
  it('menampilkan judul modul dan daftar kelas', () => {
    renderKelas(guruUser);
    expect(screen.getByText('Pengelolaan Kelas & Jadwal Pelajaran')).toBeInTheDocument();
    expect(screen.getByText('X MPLB 1')).toBeInTheDocument();
    expect(screen.getByText('Tambah Kelas Baru')).toBeInTheDocument();
  });

  it('menghitung jumlah siswa per kelas', () => {
    renderKelas(guruUser);
    expect(screen.getByText('2 Siswa')).toBeInTheDocument();
  });

  it('menampilkan tombol aksi Siswa & Roster serta Jadwal Pelajaran', () => {
    renderKelas(guruUser);
    expect(screen.getByRole('button', { name: 'Siswa & Roster' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jadwal Pelajaran' })).toBeInTheDocument();
  });

  it('menu kelola ketua hanya untuk admin', () => {
    renderKelas(guruUser);
    expect(screen.queryByText('Tetapkan / Cabut Ketua Kelas')).not.toBeInTheDocument();
  });
});
