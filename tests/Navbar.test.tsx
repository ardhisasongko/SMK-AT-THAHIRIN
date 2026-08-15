import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Navbar } from '../src/components/Navbar';

afterEach(cleanup);

describe('Navbar authentication actions', () => {
  it('shows one desktop login action and keeps hamburger mobile-only', () => {
    render(<Navbar activeTab="landing" setActiveTab={vi.fn()} currentUser={null} onLoginClick={vi.fn()} onLogoutClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Masuk Portal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka menu akun' }).parentElement).toHaveClass('sm:hidden');
  });
});
