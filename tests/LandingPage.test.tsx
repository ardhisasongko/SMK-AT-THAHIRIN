import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../src/components/LandingPage';

afterEach(cleanup);

describe('LandingPage hero', () => {
  it('menampilkan CTA login responsif untuk pengunjung', () => {
    const onOpenLogin = vi.fn();
    render(<LandingPage setActiveTab={vi.fn()} onOpenLogin={onOpenLogin} isAuthenticated={false} />);

    const loginButton = screen.getByRole('button', { name: 'Masuk Portal' });
    expect(loginButton).toHaveClass('col-span-2', 'min-w-0', 'w-full', 'sm:w-auto');
    expect(loginButton.querySelector('svg')).toBeInTheDocument();

    fireEvent.click(loginButton);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
  });

  it('menyembunyikan CTA login setelah pengguna masuk', () => {
    render(<LandingPage setActiveTab={vi.fn()} onOpenLogin={vi.fn()} isAuthenticated />);

    expect(screen.queryByRole('button', { name: 'Masuk Portal' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ujian CBT' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Absensi' })).toBeInTheDocument();
  });
});
