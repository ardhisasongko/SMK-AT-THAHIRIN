import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModulAjarSection } from '../src/components/ModulAjarSection';
import type { ModulAjar, User } from '../src/types';

const guruUser: User = {
  id: 'u2', name: 'Bpk. Guru', email: 'guru@test.id', role: 'guru', avatar: '', nipNisn: '19890215',
};

const modulList: ModulAjar[] = [
  {
    id: 'm1',
    judul: 'Modul Kearsipan Digital',
    mataPelajaran: 'Otomatisasi Tata Kelola Kearsipan Digital',
    jurusan: 'Administrasi Perkantoran',
    faseKelas: 'Fase F (Kelas XI)',
    alokasiWaktu: '4 x 45 Menit',
    tanggalDibuat: '01-01-2026',
    pembuat: 'Bpk. Guru',
    data: {
      judul: 'Modul Kearsipan Digital',
      identitas: {
        sekolah: 'SMKS PLUS AT THAHIRIN',
        mataPelajaran: 'Otomatisasi Tata Kelola Kearsipan Digital',
        jurusan: 'Administrasi Perkantoran',
        faseKelas: 'Fase F (Kelas XI)',
        alokasiWaktu: '4 x 45 Menit',
        tahunAjaran: '2026/2027',
      },
      profilPelajarPancasila: ['Bernalar Kritis', 'Mandiri'],
      saranaPrasarana: ['Komputer', 'Scanner'],
      targetPesertaDidik: 'Siswa Reguler',
      modelPembelajaran: 'PjBL',
      komponenInti: {
        tujuanPembelajaran: ['Memahami kearsipan digital'],
        pemahamanBermakna: 'Arsip digital rapi',
        pertanyaanPemantik: ['Apa itu arsip digital?'],
        kegiatanPembelajaran: { pendahuluan: ['Salam'], inti: ['Materi'], penutup: ['Refleksi'] },
        asesmen: { diagnostik: '-', formatif: '-', sumatif: '-' },
        pengayaanDanRemidial: '-',
      },
    },
  },
];

function renderModul(user: User) {
  return render(
    <ModulAjarSection
      modulList={modulList}
      setModulList={vi.fn()}
      currentUser={user}
    />
  );
}

describe('ModulAjarSection', () => {
  it('menampilkan form generator AI sebagai tab default', () => {
    renderModul(guruUser);
    expect(screen.getByText('Pembuatan & Pengelolaan Modul Ajar AI')).toBeInTheDocument();
    expect(screen.getByText('Form Input Parameter Modul')).toBeInTheDocument();
  });

  it('menampilkan koleksi modul tersimpan saat tab koleksi dipilih', () => {
    renderModul(guruUser);
    fireEvent.click(screen.getByRole('button', { name: /Koleksi Tersimpan/ }));
    expect(screen.getByText('Daftar Modul Ajar Tersimpan')).toBeInTheDocument();
    expect(screen.getByText('Modul Kearsipan Digital')).toBeInTheDocument();
    expect(screen.getByText('Bpk. Guru')).toBeInTheDocument();
  });
});
