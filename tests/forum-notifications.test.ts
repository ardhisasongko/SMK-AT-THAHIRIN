import { describe, expect, it } from 'vitest';
import { notificationVisible } from '../functions/_lib/forum-notifications';
import type { AuthUser } from '../functions/_lib/auth';

const student: AuthUser = {
  id: 'u1', name: 'Siswa', email: 's@example.test', nipNisn: '123', nik: null,
  tanggalLahir: null, role: 'siswa', classId: 'k1', ketuaStatus: 'none', jabatan: null,
  status: 'active', mustChangePassword: false,
};

describe('forum notification visibility', () => {
  it('treats a class leader as a student notification recipient', () => {
    const leader = { ...student, role: 'ketua_kelas' } as AuthUser;
    expect(notificationVisible(leader, { target_role: 'siswa', target_class_id: 'k1' })).toBe(true);
    expect(notificationVisible(leader, { target_role: 'siswa', target_class_id: 'k2' })).toBe(false);
  });

  it('notifies teachers of class forum topics without widening class broadcasts', () => {
    const teacher = { ...student, id: 'g1', role: 'guru', classId: null } as AuthUser;
    expect(notificationVisible(teacher, { category: 'Forum', target_role: 'siswa', target_class_id: 'k1' })).toBe(true);
    expect(notificationVisible(teacher, { category: 'Pengumuman', target_role: 'siswa', target_class_id: 'k1' })).toBe(false);
  });
});
