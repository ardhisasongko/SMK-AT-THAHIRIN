import { describe, expect, it, vi } from 'vitest';
import { readCollection, syncStudentRoster } from '../functions/_lib/student-roster';

describe('student roster domain', () => {
  it('mempertahankan atribut roster saat identitas siswa diubah', () => {
    const roster = [{ id: 's1', nisn: '0068123491', name: 'Lama', classId: 'k1', gender: 'P', foto: '/x.jpg', nik: '3271' }];
    const result = syncStudentRoster(roster, { oldNisn: '0068123491', nisn: '0068123492', name: 'Baru', classId: 'k2' });
    expect(result[0]).toEqual({ id: 's1', nisn: '0068123492', name: 'Baru', classId: 'k2', gender: 'P', foto: '/x.jpg', nik: '3271' });
    expect(roster[0].nisn).toBe('0068123491');
  });

  it('menolak JSON koleksi yang rusak agar roster tidak tertimpa', async () => {
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn(async () => ({ value: '{rusak' })) })) })),
    } as any;
    await expect(readCollection(db, 'siswa_v1')).rejects.toThrow('Data siswa_v1 rusak');
  });
});
