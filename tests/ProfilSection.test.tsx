import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfilSection } from '../src/components/ProfilSection';
import type { User } from '../src/types';

const student: User = {
  id: 'student-1',
  name: 'Siswa Dengan Nama Sangat Panjang',
  email: 's1234567890@smksplusatthahirin.sch.id',
  role: 'siswa',
  avatar: '',
  nipNisn: '1234567890',
};

describe('ProfilSection', () => {
  it('membungkus row dan email profil panjang pada layar sempit', () => {
    render(
      <ProfilSection
        currentUser={student}
        kelasList={[]}
        siswaList={[]}
        presensiList={[]}
        modulList={[]}
        setActiveTab={vi.fn()}
        onOpenLogin={vi.fn()}
      />,
    );

    const email = screen.getByText(student.email);
    expect(email).toHaveClass('min-w-0', 'break-all');
    expect(email.parentElement).toHaveClass('flex-col', 'sm:flex-row');
  });
});
