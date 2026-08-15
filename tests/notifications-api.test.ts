import { describe, expect, it, vi } from 'vitest';
import { listNotifications } from '../functions/api/notifications/index';
import type { AuthUser } from '../functions/_lib/auth';

const student: AuthUser = {
  id: 'u1', name: 'Siswa', email: 'siswa@example.test', nipNisn: '1', nik: null,
  tanggalLahir: null, role: 'siswa', classId: 'k1', ketuaStatus: 'none', jabatan: null,
  status: 'active', mustChangePassword: false,
};

describe('notification list query', () => {
  it('returns only the current user read state in one query', async () => {
    const all = vi.fn().mockResolvedValue({ results: [{
      id: 'n1', title: 'Info', message: 'Pesan', target_role: 'siswa', target_class_id: 'k1',
      category: 'Pengumuman', created_at: '2026-08-15', is_read: 1,
    }] });
    const bind = vi.fn(() => ({ all }));
    const prepare = vi.fn(() => ({ bind }));

    const result = await listNotifications({ prepare } as unknown as D1Database, student);

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(bind).toHaveBeenCalledWith('u1', 'siswa', 'u1', 'siswa', 'siswa', 'siswa', 'k1', 'siswa');
    expect(result[0]).toMatchObject({ id: 'n1', isRead: true, targetClassId: 'k1' });
    expect(result[0]).not.toHaveProperty('isReadBy');
  });
});
