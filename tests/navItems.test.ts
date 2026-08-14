import { describe, expect, it } from 'vitest';
import { canAccessTab, getNavItems } from '../src/navItems';
import type { User } from '../src/types';

const user = (role: User['role']): User => ({
  id: role,
  name: role,
  email: `${role}@example.test`,
  role,
  avatar: '',
});

describe('role navigation', () => {
  it('membatasi siswa ke fitur siswa', () => {
    expect(getNavItems(user('siswa')).map(item => item.id)).toEqual([
      'landing', 'cbt', 'absensi', 'forum', 'profil',
    ]);
    expect(canAccessTab(user('siswa'), 'modul-ajar')).toBe(false);
  });

  it('memberi ketua kelas menu siswa dan akses absensi', () => {
    expect(getNavItems(user('ketua_kelas')).map(item => item.id)).toEqual([
      'landing', 'cbt', 'absensi', 'forum', 'profil',
    ]);
  });

  it('memberi guru dan admin fitur pengelolaan', () => {
    expect(canAccessTab(user('guru'), 'modul-ajar')).toBe(true);
    expect(canAccessTab(user('guru'), 'kelas')).toBe(true);
    expect(canAccessTab(user('admin'), 'notifikasi')).toBe(true);
    expect(canAccessTab(user('super_admin'), 'pengguna')).toBe(true);
  });
});
