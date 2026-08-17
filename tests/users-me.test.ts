// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { onRequestPatch } from '../functions/api/users/me/index';

function makeDb(overrides: { role?: string; email?: string; duplicateEmail?: boolean; noRoster?: boolean } = {}) {
  const state = {
    userRow: {
      id: 'u1', name: 'Budi Santoso', email: overrides.email ?? 'budi@example.com', nip_nisn: '0071234567',
      nik: null, tanggal_lahir: null, role: overrides.role ?? 'siswa', class_id: 'k1',
      ketua_status: 'approved', jabatan: null, status: 'active', must_change_password: 0,
    },
    roster: overrides.noRoster ? [] : [{ id: 's1', nisn: '0071234567', name: 'Budi Santoso', classId: 'k1', gender: 'L', foto: 'x' }],
  };
  const batch = vi.fn(async (statements: any[]) => {
    for (const stmt of statements) {
      if (stmt.sql.includes('UPDATE users SET name')) {
        state.userRow.name = stmt.binds[0];
        state.userRow.email = stmt.binds[1];
      }
      if (stmt.sql.includes('UPDATE app_data')) {
        const student = JSON.parse(stmt.binds[1]);
        const idx = state.roster.findIndex((r: any) => r.nisn === stmt.binds[0]);
        if (idx >= 0) state.roster[idx] = { ...state.roster[idx], ...student };
      }
    }
    return statements.map(() => ({}));
  });
  const firstBySql = (sql: string, binds: unknown[]) => {
    if (sql.includes('sessions WHERE token')) return { token: 'sha256:x', user_id: 'u1', expires_at: new Date(Date.now() + 3600_000).toISOString() };
    if (sql.includes('FROM users u WHERE')) return { ...state.userRow };
    if (sql.includes('SELECT id FROM users WHERE email')) return overrides.duplicateEmail ? { id: 'u2' } : null;
    if (sql.includes('app_data WHERE key')) return { value: JSON.stringify(state.roster) };
    return null;
  };
  const prepare = vi.fn((sql: string) => {
    const bound = (binds: unknown[]) => ({
      first: vi.fn(async () => firstBySql(sql, binds)),
      all: vi.fn(async () => ({ results: [] })),
      run: vi.fn(async () => ({ success: true })),
    });
    return {
      sql,
      bind: vi.fn((...args: unknown[]) => ({ sql, binds: args, ...bound(args) })),
      ...bound([]),
    };
  });
  return { db: { prepare, batch } as any, state, batch };
}

function patch(body: unknown, authed = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authed) headers.Authorization = 'Bearer st_test123';
  return new Request('https://example.com/api/users/me', {
    method: 'PATCH', headers, body: JSON.stringify(body),
  });
}

describe('PATCH /api/users/me — perbarui profil sendiri', () => {
  it('siswa ganti nama: update akun + sinkronkan roster siswa_v1', async () => {
    const { db, state, batch } = makeDb({ role: 'siswa' });
    const response = await onRequestPatch({ env: { DB: db }, request: patch({ name: 'Budi Prasetyo' }) } as any);
    const json = await response.json() as any;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.user.name).toBe('Budi Prasetyo');
    expect(json.user.email).toBe('budi@example.com');
    expect(state.roster[0].name).toBe('Budi Prasetyo');
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
  });

  it('siswa ganti email saja: tidak menyentuh roster', async () => {
    const { db, batch } = makeDb({ role: 'siswa' });
    const response = await onRequestPatch({ env: { DB: db }, request: patch({ email: 'budi.baru@example.com' }) } as any);
    const json = await response.json() as any;

    expect(response.status).toBe(200);
    expect(json.user.email).toBe('budi.baru@example.com');
    expect(batch.mock.calls[0][0]).toHaveLength(1);
  });

  it('guru ganti nama + email: tanpa statement roster', async () => {
    const { db, batch } = makeDb({ role: 'guru', email: 'guru@example.com' });
    const response = await onRequestPatch({ env: { DB: db }, request: patch({ name: 'Pak Joko', email: 'joko@example.com' }) } as any);
    const json = await response.json() as any;

    expect(response.status).toBe(200);
    expect(json.user.name).toBe('Pak Joko');
    expect(json.user.email).toBe('joko@example.com');
    expect(batch.mock.calls[0][0]).toHaveLength(1);
  });

  it('email yang sudah dipakai akun lain ditolak (409)', async () => {
    const { db, batch } = makeDb({ duplicateEmail: true });
    const response = await onRequestPatch({ env: { DB: db }, request: patch({ email: 'dupe@example.com' }) } as any);
    const json = await response.json() as any;

    expect(response.status).toBe(409);
    expect(json.success).toBe(false);
    expect(batch).not.toHaveBeenCalled();
  });

  it('menolak body kosong dan nama kosong', async () => {
    const { db } = makeDb();
    const empty = await onRequestPatch({ env: { DB: db }, request: patch({}) } as any);
    expect(empty.status).toBe(400);

    const blank = await onRequestPatch({ env: { DB: db }, request: patch({ name: '   ' }) } as any);
    expect(blank.status).toBe(400);
  });

  it('menolak tanpa autentikasi', async () => {
    const { db } = makeDb();
    const response = await onRequestPatch({ env: { DB: db }, request: patch({ name: 'X' }, false) } as any);
    expect(response.status).toBe(401);
  });
});