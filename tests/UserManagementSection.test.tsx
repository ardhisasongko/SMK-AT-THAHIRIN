import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserManagementSection } from '../src/components/UserManagementSection';
import type { User } from '../src/types';

const admin: User = { id: 'a1', name: 'Admin', email: 'admin@test.id', role: 'admin', avatar: '', nipNisn: '12345678' };
const managed = { id: 'u1', name: 'Siswa Tetap', email: 'siswa@test.id', nipNisn: '0068123491', role: 'siswa', classId: 'k1', status: 'active', createdAt: '2026-01-01' };

afterEach(() => vi.unstubAllGlobals());

describe('UserManagementSection error handling', () => {
  it('menampilkan error HTTP saat pemuatan gagal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(
      JSON.stringify({ success: false, error: 'Database tidak tersedia' }), { status: 503 }
    )));
    render(<UserManagementSection currentUser={admin} />);
    expect(await screen.findByText('Database tidak tersedia')).toBeInTheDocument();
  });

  it('tidak menghilangkan pengguna atau terlihat sukses saat arsip gagal', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [managed] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'Arsip ditolak server' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('prompt', vi.fn(() => 'alasan test'));
    render(<UserManagementSection currentUser={admin} />);
    expect(await screen.findByText('Siswa Tetap')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Arsipkan'));
    expect(await screen.findByText('Arsip ditolak server')).toBeInTheDocument();
    expect(screen.getByText('Siswa Tetap')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });
});
