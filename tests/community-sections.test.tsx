import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForumSection } from '../src/components/ForumSection';
import { NotifikasiSection } from '../src/components/NotifikasiSection';
import type { Kelas, User } from '../src/types';

const teacher: User = { id: 'g1', name: 'Guru', email: 'guru@example.test', role: 'guru', avatar: '' };
const leader: User = { id: 's1', name: 'Ketua', email: 'ketua@example.test', role: 'ketua_kelas', classId: 'kelas-aktual', avatar: '' };
const classes: Kelas[] = [{ id: 'kelas-aktual', name: 'XI RPL Aktual', jurusanCode: 'RPL', tingkat: 'XI', ruang: '1', waliKelas: 'Guru', jumlahSiswa: 1, jadwal: [] }];

describe('Forum and notification forms', () => {
  it('uses current class data and clearly disables forum attachment simulation', () => {
    render(<ForumSection topics={[]} setTopics={vi.fn()} currentUser={teacher} kelasList={classes} onOpenLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /buat topik baru/i }));
    fireEvent.change(screen.getByLabelText('Tipe Kategori'), { target: { value: 'kelas' } });

    expect(screen.getByRole('option', { name: 'XI RPL Aktual' })).toBeInTheDocument();
    expect(screen.getByText('Lampiran belum tersedia')).toBeInTheDocument();
    expect(screen.queryByText(/tambahkan file/i)).not.toBeInTheDocument();
  });

  it('offers an actual class target and labels broadcasts as web-only', () => {
    render(<NotifikasiSection notifications={[]} setNotifications={vi.fn()} currentUser={teacher} kelasList={classes} setActiveTab={vi.fn()} onOpenLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /kirim broadcast notifikasi/i }));

    expect(screen.getByLabelText('Target Kelas')).toHaveValue('semua');
    expect(screen.getByRole('option', { name: 'XI RPL Aktual' })).toHaveValue('kelas-aktual');
    expect(screen.getByText(/pengiriman email belum tersedia/i)).toBeInTheDocument();
    expect(screen.queryByText(/simulasikan kirim/i)).not.toBeInTheDocument();
  });

  it('does not hide student-targeted notifications from a class leader', () => {
    render(<NotifikasiSection notifications={[{
      id: 'n1', title: 'Info Siswa', message: 'Pesan kelas', targetRole: 'siswa', targetClassId: 'kelas-aktual',
      category: 'Pengumuman', createdAt: '2026-08-15', isRead: false,
    }]} setNotifications={vi.fn()} currentUser={leader} kelasList={classes} setActiveTab={vi.fn()} onOpenLogin={vi.fn()} />);

    expect(screen.getByText('Info Siswa')).toBeInTheDocument();
  });
});
