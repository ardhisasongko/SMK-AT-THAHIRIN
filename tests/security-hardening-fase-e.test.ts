// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSession, hashPassword, type AuthUser } from '../functions/_lib/auth';
import {
  getLoginFailuresLast24h, loginFailureHourKey, recordLoginFailureStat,
} from '../functions/_lib/login-lockout';
import { wibDayString } from '../functions/_lib/gemini-quota';
import { getSystemStatus, LATEST_KNOWN_MIGRATION } from '../functions/_lib/system-status';
import { onRequestGet as healthGet } from '../functions/api/health';
import { onRequestGet as integrationStatusGet } from '../functions/api/integrations/status';
import { onRequestPost as loginPost } from '../functions/api/auth/login';

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

describe('hardening Fase E — statistik kegagalan login', () => {
  it('ember per jam: 24 jam terakhir terhitung, ember tua terabaikan dan dibersihkan', async () => {
    const db = new TestD1Database();
    const env = { DB: db as unknown as D1Database };
    const now = new Date('2026-11-02T10:15:00.000Z');
    await recordLoginFailureStat(env.DB, now);
    await recordLoginFailureStat(env.DB, now);
    await recordLoginFailureStat(env.DB, new Date(now.getTime() - 5 * 3600 * 1000));
    expect(await getLoginFailuresLast24h(env.DB, now)).toBe(3);

    // Ember 30 jam lalu tidak masuk jendela 24 jam.
    const old30 = loginFailureHourKey(new Date(now.getTime() - 30 * 3600 * 1000));
    db.run('INSERT INTO login_failure_stats (hour, failures, updated_at) VALUES (?, 7, ?)', old30, now.toISOString());
    expect(await getLoginFailuresLast24h(env.DB, now)).toBe(3);

    // Ember 72 jam lalu dibersihkan saat pencatatan berikutnya.
    const old72 = loginFailureHourKey(new Date(now.getTime() - 72 * 3600 * 1000));
    db.run('INSERT INTO login_failure_stats (hour, failures, updated_at) VALUES (?, 5, ?)', old72, now.toISOString());
    await recordLoginFailureStat(env.DB, now);
    expect(db.get('SELECT hour FROM login_failure_stats WHERE hour = ?', old72)).toBeUndefined();
    expect(await getLoginFailuresLast24h(env.DB, now)).toBe(4);
  });

  it('login gagal sungguhan tercatat di statistik', async () => {
    const db = new TestD1Database();
    const addUser = db.sqlite.prepare(
      'INSERT INTO users (id, name, email, nip_nisn, role, password_hash, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    addUser.run('g1', 'Pak Guru', 'guru@test.local', '111', 'guru', await hashPassword('MengajarAman2026'), 'active', 0);
    const env = { DB: db as unknown as D1Database };
    const attempt = (password: string) => loginPost({
      env,
      request: new Request('https://school.test/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
        body: JSON.stringify({ identifier: 'guru@test.local', password }),
      }),
      data: {},
    } as any);
    expect((await attempt('salah-password-1')).status).toBe(401);
    expect((await attempt('salah-password-2')).status).toBe(401);
    expect(await getLoginFailuresLast24h(env.DB)).toBe(2);
    expect((await attempt('MengajarAman2026')).status).toBe(200);
    expect(await getLoginFailuresLast24h(env.DB)).toBe(2);
  });
});

describe('hardening Fase E — health & status sistem', () => {
  it('health diperkaya: latensi DB, migrasi dikenal, komponen — tanpa membocorkan rahasia', async () => {
    const db = new TestD1Database();
    const env = {
      DB: db as unknown as D1Database,
      APP_NAME: 'Portal Test',
      GEMINI_ENABLED: 'true', GEMINI_API_KEY: 'RAHASIA-GEMINI-TIDAK-BOLEH-BOCOR', GEMINI_DAILY_LIMIT: '50',
      TOTP_ENCRYPTION_KEY: 'RAHASIA-TOTP-TIDAK-BOLEH-BOCOR-32KARAKTER',
      TURNSTILE_SITE_KEY: 'site-key-publik', TURNSTILE_SECRET_KEY: 'RAHASIA-TURNSTILE',
    };
    const res = await healthGet({ env, request: new Request('https://school.test/api/health') } as any);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('ok');
    expect(json.db).toBe('ok');
    expect(typeof json.dbLatencyMs).toBe('number');
    expect(json.migration.latestKnown).toBe('0033_login_failure_stats');
    expect(LATEST_KNOWN_MIGRATION).toBe('0033_login_failure_stats');
    expect(json.components).toEqual({
      gemini: { enabled: true, configured: true },
      twoFactor: { configured: true },
      turnstile: { enabled: true },
    });
    expect(json.aiQuotaToday).toEqual({ used: 0, limit: 50 });
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('RAHASIA');
    expect(serialized).not.toContain('site-key-publik');
  });

  it('health 503 degraded bila DB tidak terjangkau', async () => {
    const broken = { prepare: () => { throw new Error('d1 down'); } } as unknown as D1Database;
    const res = await healthGet({ env: { DB: broken }, request: new Request('https://school.test/api/health') } as any);
    expect(res.status).toBe(503);
    const json = await res.json() as any;
    expect(json.status).toBe('degraded');
    expect(json.db).toBe('error');
  });

  it('getSystemStatus menghitung sesi aktif, lockout aktif, dan kuota AI hari ini', async () => {
    const db = new TestD1Database();
    const env = { DB: db as unknown as D1Database, GEMINI_DAILY_LIMIT: '10' };
    db.run("INSERT INTO users (id, name, email, role, password_hash, status) VALUES ('usr-sys-1', 'Uji', 'usrsys1@test.local', 'guru', 'x', 'active')");
    await createSession(env as any, 'usr-sys-1');
    await createSession(env as any, 'usr-sys-1');
    db.run("INSERT INTO sessions (token, user_id, expires_at) VALUES ('sha256:expired', 'usr-sys-1', ?)", new Date(Date.now() - 1000).toISOString());
    db.run("INSERT INTO login_lockouts (key, failures, lock_level, locked_until, updated_at) VALUES ('account:x@y.z', 0, 1, ?, ?)",
      new Date(Date.now() + 300000).toISOString(), new Date().toISOString());
    db.run('INSERT INTO gemini_daily_usage (day, request_count, updated_at) VALUES (?, 4, ?)',
      wibDayString(), new Date().toISOString());

    const status = await getSystemStatus(env);
    expect(status.db.ok).toBe(true);
    expect(status.activeSessions).toBe(2);
    expect(status.activeLockouts).toBe(1);
    expect(status.aiQuotaToday.used).toBe(4);
    expect(status.aiQuotaToday.limit).toBe(10);
    expect(status.loginFailures24h).toBe(0);
  });

  it('endpoint status integrasi: non-admin ditolak, admin mendapat bagian system', async () => {
    const db = new TestD1Database();
    const env = { DB: db as unknown as D1Database };
    const guru = makeUser({ id: 'g1', role: 'guru' });
    const forbidden = await integrationStatusGet({ env, data: { user: guru }, request: new Request('https://school.test/api/integrations/status') } as any);
    expect(forbidden.status).toBe(403);

    const admin = makeUser({ id: 'a1', role: 'admin' });
    const res = await integrationStatusGet({ env, data: { user: admin }, request: new Request('https://school.test/api/integrations/status') } as any);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.system.latestMigration).toBe('0033_login_failure_stats');
    expect(json.data.system.db.ok).toBe(true);
    expect(json.data.gemini).toBeDefined();
    expect(json.data.whatsapp).toBeDefined();
  });
});
