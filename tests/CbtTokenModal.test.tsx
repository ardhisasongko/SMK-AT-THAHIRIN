import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CbtTokenModal } from '../src/components/cbt/CbtTokenModal';
import type { CbtExam } from '../src/types';

const exam: CbtExam = {
  id: 'c1',
  title: 'Ujian Kearsipan',
  subject: 'Kearsipan Digital',
  classTarget: 'X AP 1',
  durationMinutes: 30,
  token: 'AP1234',
  teacherName: 'Bpk. Guru',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
  questions: [],
};

function renderModal(onStart = vi.fn(), onClose = vi.fn()) {
  render(<CbtTokenModal exam={exam} onClose={onClose} onStart={onStart} />);
  return { onStart, onClose };
}

describe('CbtTokenModal', () => {
  it('menolak token yang salah', () => {
    const { onStart } = renderModal();
    const input = screen.getByPlaceholderText('Masukkan 6 Digit Token');
    fireEvent.change(input, { target: { value: 'WRONG' } });
    fireEvent.click(screen.getByRole('button', { name: /Mulai Ujian Sekarang/ }));

    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/Token ujian tidak valid/)).toBeInTheDocument();
  });

  it('memulai ujian ketika token benar (case-insensitive)', () => {
    const { onStart } = renderModal();
    const input = screen.getByPlaceholderText('Masukkan 6 Digit Token');
    fireEvent.change(input, { target: { value: 'ap1234' } });
    fireEvent.click(screen.getByRole('button', { name: /Mulai Ujian Sekarang/ }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Token ujian tidak valid/)).not.toBeInTheDocument();
  });
});
