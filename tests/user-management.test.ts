import { describe, expect, it, vi } from 'vitest';
import { onRequestPatch, onRequestPost } from '../functions/api/users/index';

vi.mock('../functions/_lib/auth', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/auth')>('../functions/_lib/auth');
  return { ...actual, hashPassword: vi.fn(async () => 'hash') };
});

type BoundStatement = { sql: string; args: unknown[]; first: () => Promise<unknown>; run: () => Promise<{ success: boolean }> };

function makeDb(options: { target?: Record<string, unknown>; batchError?: boolean } = {}) {
  const batches: BoundStatement[][] = [];
  const classes = [{ id: 'k1', name: 'X MPLB 1' }];
  const roster = [{ id: 's1', nisn: '0068123491', name: 'Nama Lama', classId: 'k1', gender: 'P', foto: '/lama.jpg', nik: '123' }];
  const prepare = (sql: string) => {
    const statement = {
      sql,
      args: [] as unknown[],
      first: async () => {
        if (sql.includes('FROM app_data')) {
          if (statement.args[0] === 'kelas_v1') return { value: JSON.stringify(classes) };
          if (statement.args[0] === 'siswa_v1') return { value: JSON.stringify(roster) };
        }
        if (sql.includes('password_hash FROM users WHERE id')) return options.target || null;
        return null;
      },
      run: async () => ({ success: true }),
      bind: (...args: unknown[]) => {
        statement.args = args;
        return statement;
      },
    } satisfies BoundStatement & { bind: (...args: unknown[]) => BoundStatement };
    return statement;
  };
  const db = {
    prepare,
    batch: vi.fn(async (statements: BoundStatement[]) => {
      if (options.batchError) throw new Error('batch failed');
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    }),
  } as any;
  return { db, batches };
}

function request(role: string, overrides: Record<string, unknown> = {}) {
  return new Request('http://test/api/users', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'test@example.sch.id', identifier: '12345678', role, ...overrides }),
  });
}

const ADMIN = { id: 'a', name: 'Admin', role: 'admin' } as any;
const SUPER_ADMIN = { id: 'sa', name: 'Super', role: 'super_admin' } as any;

describe('user management', () => {
  it('admin tidak boleh membuat admin lain', async () => {
    const { db } = makeDb();
    const res = await onRequestPost({ env: { DB: db }, request: request('admin'), data: { user: ADMIN } } as any);
    expect(res.status).toBe(400);
  });

  it('super admin boleh membuat admin melalui batch akun dan audit', async () => {
    const { db, batches } = makeDb();
    const res = await onRequestPost({ env: { DB: db }, request: request('admin'), data: { user: SUPER_ADMIN } } as any);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ success: true, initialPassword: expect.any(String) });
    expect(batches[0]).toHaveLength(2);
  });

  it('membuat akun siswa dan roster dalam batch atomik yang sama', async () => {
    const { db, batches } = makeDb();
    const res = await onRequestPost({
      env: { DB: db }, data: { user: ADMIN },
      request: request('siswa', { identifier: '0068123499', classId: 'k1', gender: 'P' }),
    } as any);
    expect(res.status).toBe(201);
    expect(batches[0]).toHaveLength(6);
    const rosterWrite = batches[0].find(statement => statement.sql.includes('INSERT INTO app_data'))!;
    const saved = JSON.parse(String(rosterWrite.args[1]));
    expect(saved).toEqual(expect.arrayContaining([
      expect.objectContaining({ nisn: '0068123499', name: 'Test User', classId: 'k1', gender: 'P' }),
    ]));
  });

  it('menolak siswa dengan NISN atau kelas tidak valid sebelum menulis', async () => {
    const { db } = makeDb();
    const invalidNisn = await onRequestPost({
      env: { DB: db }, data: { user: ADMIN }, request: request('siswa', { identifier: '123', classId: 'k1' }),
    } as any);
    expect(invalidNisn.status).toBe(400);

    const invalidClass = await onRequestPost({
      env: { DB: db }, data: { user: ADMIN }, request: request('siswa', { identifier: '0068123499', classId: 'unknown', gender: 'L' }),
    } as any);
    expect(invalidClass.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('edit NISN, nama, dan kelas siswa ikut memperbarui roster dalam satu batch', async () => {
    const target = {
      id: 'u1', name: 'Nama Lama', email: 'lama@example.sch.id', nip_nisn: '0068123491', role: 'siswa',
      class_id: 'k1', jabatan: null, status: 'active', must_change_password: 0, archived_at: null, created_at: '2026-01-01',
    };
    const { db, batches } = makeDb({ target });
    const req = new Request('http://test/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'u1', name: 'Nama Baru', email: 'baru@example.sch.id', identifier: '0068123498', role: 'siswa', classId: 'k1' }),
    });
    const res = await onRequestPatch({ env: { DB: db }, data: { user: ADMIN }, request: req } as any);
    expect(res.status).toBe(200);
    const rosterWrite = batches[0].find(statement => statement.sql.includes('INSERT INTO app_data'))!;
    const saved = JSON.parse(String(rosterWrite.args[1]));
    expect(saved).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 's1', nisn: '0068123498', name: 'Nama Baru', classId: 'k1', gender: 'P', nik: '123' }),
    ]));
  });

  it('mengembalikan gagal dan bukan sukses jika batch atomik gagal', async () => {
    const { db } = makeDb({ batchError: true });
    const res = await onRequestPost({ env: { DB: db }, request: request('admin'), data: { user: SUPER_ADMIN } } as any);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(expect.objectContaining({ success: false }));
  });
});
