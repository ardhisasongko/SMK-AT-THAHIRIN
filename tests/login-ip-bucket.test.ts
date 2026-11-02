// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../functions/_lib/auth';
import { consumeRateLimit, rateLimitExceeded } from '../functions/_lib/rate-limit';
import { onRequestPost as loginPost } from '../functions/api/auth/login';

// Harness D1 in-memory dengan seluruh migrasi — pola yang sama seperti
// tests/security-hardening-fase-c.test.ts.
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

const PASSWORD = 'MengajarAman2026';

async function seed() {
  const db = new TestD1Database();
  const hash = await hashPassword(PASSWORD);
  db.sqlite.prepare(
    'INSERT INTO users (id, name, email, nip_nisn, role, password_hash, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('g1', 'Pak Guru', 'guru@test.local', '198902152015', 'guru', hash, 'active', 0);
  const env = { DB: db as unknown as D1Database };
  return { db, env };
}

function loginRequest(body: Record<string, unknown>, ip: string): Request {
  return new Request('https://school.test/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

async function login(env: any, identifier: string, password: string, ip: string) {
  const res = await loginPost({ env, request: loginRequest({ identifier, password }, ip), data: {} } as any);
  return { res, json: await res.json() as any };
}

function ipBucketCount(db: TestD1Database, ip: string): number | undefined {
  return db.get<{ request_count: number }>(
    'SELECT request_count FROM api_rate_limits WHERE key=?', `login-ip:${ip}`,
  )?.request_count;
}

function seedIpBucket(db: TestD1Database, ip: string, count: number) {
  const now = Math.floor(Date.now() / 1000);
  db.run(
    'INSERT INTO api_rate_limits (key, window_started, request_count, window_expires) VALUES (?, ?, ?, ?)',
    `login-ip:${ip}`, now, count, now + 900,
  );
}

describe('rateLimitExceeded — pemeriksaan ember tanpa menulis', () => {
  it('false bila belum ada baris; true saat mencapai batas; peek tidak mengubah hitungan', async () => {
    const db = new TestD1Database();
    const d1 = db as unknown as D1Database;
    expect(await rateLimitExceeded(d1, 'peek', 2)).toBe(false);
    await consumeRateLimit(d1, 'peek', 2, 60);
    expect(await rateLimitExceeded(d1, 'peek', 2)).toBe(false);
    await consumeRateLimit(d1, 'peek', 2, 60);
    expect(await rateLimitExceeded(d1, 'peek', 2)).toBe(true);
    expect(await rateLimitExceeded(d1, 'peek', 2)).toBe(true);
    expect(db.get<{ request_count: number }>(
      'SELECT request_count FROM api_rate_limits WHERE key=?', 'peek',
    )?.request_count).toBe(2);
  });

  it('false lagi setelah jendela berakhir (ember dianggap mulai baru)', async () => {
    const db = new TestD1Database();
    const now = Math.floor(Date.now() / 1000);
    db.run(
      'INSERT INTO api_rate_limits (key, window_started, request_count, window_expires) VALUES (?, ?, ?, ?)',
      'basi', now - 1200, 500, now - 300,
    );
    expect(await rateLimitExceeded(db as unknown as D1Database, 'basi', 500)).toBe(false);
  });
});

describe('login — ember IP hanya menghitung percobaan GAGAL', () => {
  it('setiap login gagal menaikkan ember IP tepat satu (akun tak ditemukan + password salah)', async () => {
    const { db, env } = await seed();
    const ip = '198.51.100.21';
    expect((await login(env, 'tidakada1@test.local', 'apa-saja-1', ip)).res.status).toBe(401);
    expect((await login(env, 'tidakada2@test.local', 'apa-saja-2', ip)).res.status).toBe(401);
    expect((await login(env, 'guru@test.local', 'password-yang-salah', ip)).res.status).toBe(401);
    expect(ipBucketCount(db, ip)).toBe(3);
  });

  it('login BERHASIL tidak menaikkan ember IP dan tidak membuat barisnya', async () => {
    const { db, env } = await seed();
    const ip = '198.51.100.22';
    expect((await login(env, 'guru@test.local', PASSWORD, ip)).res.status).toBe(200);
    expect((await login(env, 'guru@test.local', PASSWORD, ip)).res.status).toBe(200);
    expect(ipBucketCount(db, ip)).toBeUndefined();
  });

  it('ambang ember IP yang terisi kegagalan menolak login berikutnya — termasuk password benar', async () => {
    const { db, env } = await seed();
    const ip = '198.51.100.23';
    seedIpBucket(db, ip, 499);
    const failed = await login(env, 'guru@test.local', 'password-yang-salah', ip);
    expect(failed.res.status).toBe(401);
    expect(ipBucketCount(db, ip)).toBe(500);
    const blocked = await login(env, 'guru@test.local', PASSWORD, ip);
    expect(blocked.res.status).toBe(429);
    // Pesan ember rate-limit, bukan pesan lockout bertahap Fase C.
    expect(blocked.json.error).toContain('Coba lagi beberapa menit');
  });

  it('login berhasil berulang di bawah ambang tidak pernah memicu 429 ember IP (kasus NAT sekolah)', async () => {
    const { db, env } = await seed();
    const ip = '198.51.100.24';
    seedIpBucket(db, ip, 499);
    expect((await login(env, 'guru@test.local', PASSWORD, ip)).res.status).toBe(200);
    expect((await login(env, 'guru@test.local', PASSWORD, ip)).res.status).toBe(200);
    expect(ipBucketCount(db, ip)).toBe(499);
  });
});
