// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, hashPassword, type AuthUser } from '../functions/_lib/auth';
import {
  accountLockoutKey, clearLoginLockout, getLoginLockoutUntil, ipLockoutKey,
  recordLoginFailure, ACCOUNT_FAILURE_THRESHOLD, IP_FAILURE_THRESHOLD,
} from '../functions/_lib/login-lockout';
import { onRequestPost as loginPost } from '../functions/api/auth/login';
import { onRequestGet as loginConfigGet } from '../functions/api/auth/login-config';
import { onRequestPost as resetPasswordPost } from '../functions/api/users/reset-password';
import { onRequestGet as exportScoresGet } from '../functions/api/cbt/export/scores';

class TestD1Database {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys=ON');
    const files = readdirSync(new URL('../migrations', import.meta.url)).sort();
    for (const file of files) {
      this.sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    }
  }

  prepare(query: string) {
    const statement = this.sqlite.prepare(query);
    let values: unknown[] = [];
    const prepared = {
      bind: (...bindings: unknown[]) => { values = bindings; return prepared; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
    };
    return prepared;
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const stmt of statements) results.push(await stmt.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  get<T>(query: string, ...values: unknown[]): T | undefined {
    return this.sqlite.prepare(query).get(...values) as T | undefined;
  }

  run(query: string, ...values: unknown[]) {
    return this.sqlite.prepare(query).run(...values);
  }
}

function makeUser(overrides: Partial<AuthUser> & { id: string; role: string }): AuthUser {
  return {
    name: overrides.id, email: `${overrides.id}@test.local`, nipNisn: null, nik: null,
    tanggalLahir: null, classId: null, ketuaStatus: 'none', jabatan: null,
    status: 'active', mustChangePassword: false, ...overrides,
  } as AuthUser;
}

const PASSWORD = 'MengajarAman2026';

async function seed(extraEnv: Record<string, string> = {}) {
  const db = new TestD1Database();
  const addUser = db.sqlite.prepare(
    'INSERT INTO users (id, name, email, nip_nisn, role, password_hash, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const hash = await hashPassword(PASSWORD);
  addUser.run('g1', 'Pak Guru', 'guru@test.local', '198902152015', 'guru', hash, 'active', 0);
  addUser.run('a1', 'Admin Satu', 'admin@test.local', '9001', 'admin', hash, 'active', 0);
  const env = { DB: db as unknown as D1Database, ...extraEnv };
  return { db, env };
}

function loginRequest(body: Record<string, unknown>, ip = '203.0.113.10'): Request {
  return new Request('https://school.test/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

async function login(env: any, identifier: string, password: string, extra: Record<string, unknown> = {}, ip?: string) {
  const res = await loginPost({ env, request: loginRequest({ identifier, password, ...extra }, ip), data: {} } as any);
  return { res, json: await res.json() as any };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('hardening Fase C — lockout bertahap (unit)', () => {
  it('mengunci akun setelah ambang kegagalan dan durasi naik per level', async () => {
    const db = new TestD1Database() as unknown as D1Database;
    const raw = db as unknown as TestD1Database;
    const key = accountLockoutKey('Guru@Test.Local');
    expect(key).toBe('account:guru@test.local');
    for (let i = 0; i < ACCOUNT_FAILURE_THRESHOLD - 1; i++) await recordLoginFailure(db, key, ACCOUNT_FAILURE_THRESHOLD);
    expect(await getLoginLockoutUntil(db, [key])).toBeNull();
    await recordLoginFailure(db, key, ACCOUNT_FAILURE_THRESHOLD);
    const until1 = await getLoginLockoutUntil(db, [key]);
    expect(until1).not.toBeNull();
    const minutes1 = (until1!.getTime() - Date.now()) / 60000;
    expect(minutes1).toBeGreaterThan(4);
    expect(minutes1).toBeLessThan(6);

    // Kunci berakhir -> kegagalan baru menaikkan level (durasi lebih lama).
    raw.run('UPDATE login_lockouts SET locked_until = ? WHERE key = ?', new Date(Date.now() - 1000).toISOString(), key);
    for (let i = 0; i < ACCOUNT_FAILURE_THRESHOLD; i++) await recordLoginFailure(db, key, ACCOUNT_FAILURE_THRESHOLD);
    const until2 = await getLoginLockoutUntil(db, [key]);
    const minutes2 = (until2!.getTime() - Date.now()) / 60000;
    expect(minutes2).toBeGreaterThan(14);
    expect(minutes2).toBeLessThan(16);

    await clearLoginLockout(db, key);
    expect(await getLoginLockoutUntil(db, [key])).toBeNull();
    expect(raw.get('SELECT key FROM login_lockouts WHERE key = ?', key)).toBeUndefined();
  });

  it('ambang IP jauh lebih tinggi (menghormati NAT sekolah)', async () => {
    const db = new TestD1Database() as unknown as D1Database;
    const key = ipLockoutKey('198.51.100.7');
    for (let i = 0; i < IP_FAILURE_THRESHOLD - 1; i++) await recordLoginFailure(db, key, IP_FAILURE_THRESHOLD);
    expect(await getLoginLockoutUntil(db, [key])).toBeNull();
    await recordLoginFailure(db, key, IP_FAILURE_THRESHOLD);
    expect(await getLoginLockoutUntil(db, [key])).not.toBeNull();
  });

  it('fail-open bila tabel belum ada (deployment lama tanpa migrasi 0031)', async () => {
    const bare = new DatabaseSync(':memory:');
    const fakeDb = {
      prepare: (query: string) => {
        const statement = bare.prepare(query);
        let values: unknown[] = [];
        const prepared = {
          bind: (...b: unknown[]) => { values = b; return prepared; },
          first: async () => { throw new Error('no such table: login_lockouts'); },
          run: async () => statement.run(...values),
        };
        return prepared;
      },
    } as unknown as D1Database;
    await expect(recordLoginFailure(fakeDb, 'account:x@y.z', 5)).resolves.toBeUndefined();
    await expect(clearLoginLockout(fakeDb, 'account:x@y.z')).resolves.toBeUndefined();
    await expect(getLoginLockoutUntil(fakeDb, ['account:x@y.z'])).resolves.toBeNull();
  });
});

describe('hardening Fase C — lockout di endpoint login', () => {
  it('password benar pun ditolak saat terkunci; kunci berakhir -> login pulih dan baris bersih', async () => {
    const { db, env } = await seed();
    for (let i = 0; i < ACCOUNT_FAILURE_THRESHOLD; i++) {
      const attempt = await login(env, 'guru@test.local', 'password-salah-1');
      expect(attempt.res.status).toBe(401);
    }
    const locked = await login(env, 'guru@test.local', PASSWORD);
    expect(locked.res.status).toBe(429);
    expect(locked.json.error).toContain('percobaan login gagal');

    db.run("UPDATE login_lockouts SET locked_until = ? WHERE key = 'account:guru@test.local'",
      new Date(Date.now() - 1000).toISOString());
    const recovered = await login(env, 'guru@test.local', PASSWORD);
    expect(recovered.res.status).toBe(200);
    expect(db.get('SELECT key FROM login_lockouts WHERE key = ?', 'account:guru@test.local')).toBeUndefined();
  });

  it('reset password oleh admin membuka kunci akun (jalan pemulihan)', async () => {
    const { env } = await seed();
    for (let i = 0; i < ACCOUNT_FAILURE_THRESHOLD; i++) {
      await login(env, 'guru@test.local', 'password-salah-1');
    }
    const locked = await login(env, 'guru@test.local', PASSWORD);
    expect(locked.res.status).toBe(429);

    const admin = makeUser({ id: 'a1', role: 'admin', email: 'admin@test.local' });
    const resetRes = await resetPasswordPost({
      env, data: { user: admin },
      request: new Request('https://school.test/api/users/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'g1' }),
      }),
    } as any);
    expect(resetRes.status).toBe(200);
    const resetJson = await resetRes.json() as any;
    const after = await login(env, 'guru@test.local', String(resetJson.initialPassword));
    expect(after.res.status).toBe(200);
    expect(after.json.user.mustChangePassword).toBe(true);
  });
});

describe('hardening Fase C — Turnstile siap-env', () => {
  const TURNSTILE_ENV = { TURNSTILE_SITE_KEY: 'site-key-test', TURNSTILE_SECRET_KEY: 'secret-key-test' };

  function stubSiteverify(success: boolean) {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetcher);
    return fetcher;
  }

  it('login-config hanya membagikan site key bila fitur aktif penuh', async () => {
    const plain = await seed();
    const res1 = await loginConfigGet({ env: plain.env, request: new Request('https://school.test/api/auth/login-config') } as any);
    expect(((await res1.json()) as any).data.turnstileSiteKey).toBeNull();

    const active = await seed(TURNSTILE_ENV);
    const res2 = await loginConfigGet({ env: active.env, request: new Request('https://school.test/api/auth/login-config') } as any);
    expect(((await res2.json()) as any).data.turnstileSiteKey).toBe('site-key-test');

    const half = await seed({ TURNSTILE_SITE_KEY: 'site-key-test' });
    const res3 = await loginConfigGet({ env: half.env, request: new Request('https://school.test/api/auth/login-config') } as any);
    expect(((await res3.json()) as any).data.turnstileSiteKey).toBeNull();
  });

  it('token valid -> login berjalan; token ditolak Cloudflare -> 401 generik; token kosong -> 401', async () => {
    const { env } = await seed(TURNSTILE_ENV);
    stubSiteverify(true);
    const ok = await login(env, 'guru@test.local', PASSWORD, { turnstileToken: 'token-ok' });
    expect(ok.res.status).toBe(200);

    const second = await seed(TURNSTILE_ENV);
    stubSiteverify(false);
    const rejected = await login(second.env, 'guru@test.local', PASSWORD, { turnstileToken: 'token-buruk' });
    expect(rejected.res.status).toBe(401);
    expect(rejected.json.error).toContain('Verifikasi keamanan gagal');

    const third = await seed(TURNSTILE_ENV);
    const fetcher = stubSiteverify(true);
    const missing = await login(third.env, 'guru@test.local', PASSWORD);
    expect(missing.res.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('env kosong -> login tanpa token persis seperti sebelumnya', async () => {
    const { env } = await seed();
    const ok = await login(env, 'guru@test.local', PASSWORD);
    expect(ok.res.status).toBe(200);
    expect(ok.json.success).toBe(true);
  });
});

describe('hardening Fase C — rate limit endpoint mahal', () => {
  it('ekspor nilai CBT dibatasi ember khusus 10/jam per pengguna', async () => {
    const { env } = await seed();
    const token = await createSession(env as any, 'g1');
    const call = () => exportScoresGet({
      env,
      request: new Request('https://school.test/api/cbt/export/scores', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    } as any);
    for (let i = 0; i < 10; i++) {
      const res = await call();
      expect(res.status).toBe(200);
    }
    const blocked = await call();
    expect(blocked.status).toBe(429);
  });
});
