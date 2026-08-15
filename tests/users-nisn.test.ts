import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../functions/_lib/auth', () => ({
  getUserFromRequest: vi.fn(),
}));

import { getUserFromRequest } from '../functions/_lib/auth';
import { onRequestPatch } from '../functions/api/users/nisn';

const mockedGetUser = vi.mocked(getUserFromRequest);

function makeDb(accountRow: Record<string, unknown> | null, clashRow: Record<string, unknown> | null, batchError = false) {
  const binds: unknown[][] = [];
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => {
      binds.push(args);
      return {
        first: async () => {
          if (sql.includes('FROM app_data')) return { value: JSON.stringify([{ id: 's1', nisn: '1234567801', name: 'SAINA', classId: 'k1', gender: 'P', foto: '/s.jpg' }]) };
          return sql.includes("role = 'siswa'") ? accountRow : clashRow;
        },
        run: async () => ({ success: true }),
      };
    },
  });
  return { db: { prepare, batch: async () => { if (batchError) throw new Error('fail'); return []; } } as any, binds };
}

function patchReq(body: unknown) {
  return new Request('http://test.local/api/users/nisn', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function call(db: ReturnType<typeof makeDb>['db'], req: Request) {
  return onRequestPatch({ env: { DB: db }, request: req } as any);
}

const ACCOUNT = {
  id: 'u-s1234567801',
  email: 's1234567801@smksplusatthahirin.sch.id',
  name: 'SAINA ALYATUL ULYA KADIR',
};

const ADMIN = { id: 'u1', role: 'admin' } as any;
const GURU = { id: 'u-g1', role: 'guru' } as any;

beforeEach(() => {
  mockedGetUser.mockReset();
});

describe('PATCH /api/users/nisn', () => {
  it('menolak tanpa autentikasi (401)', async () => {
    mockedGetUser.mockResolvedValue(null);
    const { db } = makeDb(null, null);
    const res = await call(db, patchReq({ oldNisn: '1234567801', newNisn: '0068123401' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it('menolak user non-admin (403)', async () => {
    mockedGetUser.mockResolvedValue(GURU);
    const { db } = makeDb(ACCOUNT, null);
    const res = await call(db, patchReq({ oldNisn: '1234567801', newNisn: '0068123401' }));
    expect(res.status).toBe(403);
  });

  it('meminta oldNisn & newNisn (400)', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    const { db } = makeDb(ACCOUNT, null);
    const res = await call(db, patchReq({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('wajib diisi') });
  });

  it('menolak NISN yang bukan 10 digit (400)', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    const { db } = makeDb(ACCOUNT, null);
    const res = await call(db, patchReq({ oldNisn: '1234567801', newNisn: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('404 bila akun siswa lama tidak ditemukan', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    const { db } = makeDb(null, null);
    const res = await call(db, patchReq({ oldNisn: '9999999999', newNisn: '0068123401' }));
    expect(res.status).toBe(404);
  });

  it('409 bila email baru sudah dipakai akun lain', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    const { db } = makeDb(ACCOUNT, { id: 'u-lain' });
    const res = await call(db, patchReq({ oldNisn: '1234567801', newNisn: '0068123401' }));
    expect(res.status).toBe(409);
  });

  it('sukses: update nip_nisn, email, name', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    const { db, binds } = makeDb(ACCOUNT, null);
    const res = await call(db, patchReq({ oldNisn: '1234567801', newNisn: '0068123401', name: 'SAINA A. K.' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ nip_nisn: '0068123401', email: 's0068123401@smksplusatthahirin.sch.id' });

    const update = binds.find((b) => b[0] === '0068123401');
    expect(update).toEqual(['0068123401', 's0068123401@smksplusatthahirin.sch.id', 'SAINA A. K.', 'u-s1234567801']);
  });

  it('mengembalikan 500 bila batch akun dan roster gagal', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    const { db } = makeDb(ACCOUNT, null, true);
    const res = await call(db, patchReq({ oldNisn: '1234567801', newNisn: '0068123401' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ success: false });
  });
});
