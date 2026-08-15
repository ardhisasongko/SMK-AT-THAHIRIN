import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestDelete as revokeKetua, onRequestPost as promoteKetua } from '../functions/api/users/ketua';
import { onRequestPost as upload } from '../functions/api/upload';
import { consumeRateLimit } from '../functions/_lib/rate-limit';

vi.mock('../functions/_lib/auth', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/auth')>('../functions/_lib/auth');
  return { ...actual, hashPassword: vi.fn(async () => 'password-hash') };
});

vi.mock('../functions/_lib/rate-limit', () => ({
  consumeRateLimit: vi.fn(),
}));

const ADMIN = { id: 'admin-1', role: 'admin' } as any;

function statement(first: unknown = null) {
  const bound = {
    bind: vi.fn((..._args: unknown[]) => bound),
    first: vi.fn(async () => first),
    run: vi.fn(async () => ({ success: true })),
  };
  return bound;
}

describe('users/ketua hardening', () => {
  it('menolak promosi jika akun yang memakai NISN bukan siswa', async () => {
    const roster = statement({ value: JSON.stringify([{ id: 'roster-1', nisn: '0011223344', name: 'Target', classId: 'k1' }]) });
    const existing = statement({ id: 'guru-1', role: 'guru' });
    const db = {
      prepare: vi.fn((sql: string) => sql.includes('FROM app_data') ? roster : existing),
    };
    const request = new Request('https://school.test/api/users/ketua', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siswaId: 'roster-1', classId: 'k1' }),
    });

    const response = await promoteKetua({ env: { DB: db }, request, data: { user: ADMIN } } as any);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, error: expect.stringContaining('akun siswa') });
    expect(existing.run).not.toHaveBeenCalled();
  });

  it('menolak pencabutan pengguna yang bukan ketua kelas', async () => {
    const target = statement({ role: 'siswa' });
    const db = { prepare: vi.fn(() => target), batch: vi.fn() };
    const request = new Request('https://school.test/api/users/ketua', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'siswa-1' }),
    });

    const response = await revokeKetua({ env: { DB: db }, request, data: { user: ADMIN } } as any);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, error: expect.stringContaining('bukan ketua kelas') });
    expect(db.batch).not.toHaveBeenCalled();
  });
});

describe('upload hardening', () => {
  beforeEach(() => {
    vi.mocked(consumeRateLimit).mockReset();
  });

  it('menolak upload saat rate limit habis', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(false);
    const db = { prepare: vi.fn() };

    const response = await upload({
      env: { DB: db },
      request: new Request('https://school.test/api/upload', { method: 'POST', body: new Uint8Array([0xff, 0xd8, 0xff]) }),
      data: { user: { id: 'user-1' } },
    } as any);

    expect(response.status).toBe(429);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('menolak upload baru saat kuota harian habis', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(true);
    const quota = statement({ total: 20 });

    const response = await upload({
      env: { DB: { prepare: vi.fn(() => quota) } },
      request: new Request('https://school.test/api/upload', { method: 'POST', body: new Uint8Array([0xff, 0xd8, 0xff]) }),
      data: { user: { id: 'user-1' } },
    } as any);

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('20 foto') });
  });

  it('menolak payload aktual yang lebih besar dari 2MB', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(true);
    const quota = statement({ total: 0 });
    const bytes = new Uint8Array(2 * 1024 * 1024 + 1);
    bytes.set([0xff, 0xd8, 0xff]);

    const response = await upload({
      env: { DB: { prepare: vi.fn(() => quota) } },
      request: new Request('https://school.test/api/upload', { method: 'POST', body: bytes }),
      data: { user: { id: 'user-1' } },
    } as any);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('2MB') });
    expect(quota.run).not.toHaveBeenCalled();
  });
});
