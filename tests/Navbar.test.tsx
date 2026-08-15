import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Navbar } from '../src/components/Navbar';
import type { User } from '../src/types';

const student: User = {
  id: 'u3',
  name: 'Muhammad Rizky Pratama',
  email: 'siswa@example.test',
  role: 'siswa',
  avatar: 'https://example.test/avatar.jpg',
};

afterEach(cleanup);

describe('Navbar pengguna', () => {
  it('menampilkan menu akun tanpa bar informasi desktop lama', () => {
    render(<Navbar setActiveTab={vi.fn()} currentUser={student} onLogoutClick={vi.fn()} />);

    expect(screen.getByText(student.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka menu akun' }).parentElement).toHaveClass('sm:hidden');
    expect(screen.queryByText('Tahun Ajaran 2026/2027')).not.toBeInTheDocument();
    expect(screen.queryByText('Navigasi menu aktif di dock bawah layar')).not.toBeInTheDocument();
  });
});
