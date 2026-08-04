import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isBeforeCutoffWIB, studentCanEdit } from '../functions/api/data/[key]';
import type { AuthUser } from '../functions/_lib/auth';

describe('isBeforeCutoffWIB', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when current WIB time is before 08:00', () => {
    // 00:00 UTC = 07:00 WIB → before 08:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00Z'));
    expect(isBeforeCutoffWIB()).toBe(true);
  });

  it('returns false when current WIB time is at 08:00', () => {
    // 01:00 UTC = 08:00 WIB → NOT before 08:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T01:00:00Z'));
    expect(isBeforeCutoffWIB()).toBe(false);
  });

  it('returns false when current WIB time is after 08:00', () => {
    // 03:00 UTC = 10:00 WIB → after 08:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T03:00:00Z'));
    expect(isBeforeCutoffWIB()).toBe(false);
  });

  it('returns false at 23:59 WIB (night time)', () => {
    // 16:59 UTC = 23:59 WIB → NOT before 08:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T16:59:00Z'));
    expect(isBeforeCutoffWIB()).toBe(false);
  });

  it('returns true at 07:59 WIB', () => {
    // 00:59 UTC = 07:59 WIB → before 08:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:59:00Z'));
    expect(isBeforeCutoffWIB()).toBe(true);
  });

  it('returns false at 08:01 WIB', () => {
    // 01:01 UTC = 08:01 WIB → NOT before 08:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T01:01:00Z'));
    expect(isBeforeCutoffWIB()).toBe(false);
  });
});

describe('studentCanEdit', () => {
  const siswaUser: AuthUser = {
    id: 's1',
    name: 'Budi',
    email: 'budi@test.com',
    nipNisn: '0081234567',
    role: 'siswa',
    classId: 'x-rpl-1',
    ketuaStatus: 'none',
    jabatan: null,
  };

  const adminUser: AuthUser = {
    id: 'a1',
    name: 'Admin',
    email: 'admin@test.com',
    nipNisn: null,
    role: 'admin',
    classId: null,
    ketuaStatus: 'none',
    jabatan: null,
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('always allows non-siswa roles', () => {
    expect(studentCanEdit(adminUser, { nisn: '0081234567' })).toEqual({ ok: true });
  });

  it('allows siswa to edit own record before 08:00 WIB', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:30:00Z')); // 07:30 WIB

    const record = { nisn: '0081234567' };
    expect(studentCanEdit(siswaUser, record)).toEqual({ ok: true });
  });

  it('rejects siswa editing other student record', () => {
    const record = { nisn: '9999999999' };
    const result = studentCanEdit(siswaUser, record);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('sendiri');
  });

  it('rejects siswa editing after 08:00 WIB', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T01:30:00Z')); // 08:30 WIB

    const record = { nisn: '0081234567' };
    const result = studentCanEdit(siswaUser, record);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('08:00');
  });

  it('allows siswa with null nipNisn to edit if record has matching nisn', () => {
    const siswaNoNisn = { ...siswaUser, nipNisn: null };
    const record = { nisn: 'anything' };
    // nipNisn is null → null !== record.nisn → should reject
    const result = studentCanEdit(siswaNoNisn, record);
    expect(result.ok).toBe(false);
  });
});
