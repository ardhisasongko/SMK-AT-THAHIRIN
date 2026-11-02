// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/_middleware';

vi.mock('../functions/_lib/auth', () => ({
  getUserFromRequest: vi.fn(async () => ({ id: 'u1', mustChangePassword: false })),
}));

// Harness D1 in-memory minimal: middleware hanya menyentuh tabel
// api_rate_limits (auth di-mock), sama seperti pola tests/rate-limit.test.ts.
class TestD1Database {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor() {
    const migrations = [
      new URL('../migrations/0011_api_rate_limits.sql', import.meta.url),
      new URL('../migrations/0014_rate_limit_expiration.sql', import.meta.url),
    ];
    for (const migration of migrations) {
      this.sqlite.exec(readFileSync(migration, 'utf8'));
    }
  }

  prepare(query: string) {
    const statement = this.sqlite.prepare(query);
    let values: unknown[] = [];
    const prepared = {
      bind: (...bindings: unknown[]) => {
        values = bindings;
        return prepared;
      },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      run: async () => {
        const result = statement.run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
    };
    return prepared;
  }

  get<T>(query: string, ...values: unknown[]): T | undefined {
    return this.sqlite.prepare(query).get(...values) as T | undefined;
  }
}

async function runMiddleware(db: TestD1Database, path: string) {
  const next = vi.fn(async () => new Response('ok', { status: 200 }));
  const request = new Request(`https://school.test${path}`, { method: 'GET' });
  const response = await onRequest({ request, env: { DB: db }, data: {}, next } as any);
  return { response, next };
}

function readCount(db: TestD1Database): number | undefined {
  return db.get<{ request_count: number }>(
    'SELECT request_count FROM api_rate_limits WHERE key=?', 'read:u1',
  )?.request_count;
}

describe('middleware — GET notices attempt dikecualikan dari ember baca', () => {
  it('polling notices berulang tidak menulis ember baca sama sekali', async () => {
    const db = new TestD1Database();
    for (let i = 0; i < 5; i++) {
      const { response, next } = await runMiddleware(db, '/api/cbt/attempts/att-1/notices');
      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalled();
    }
    expect(readCount(db)).toBeUndefined();
  });

  it('GET rute lain tetap terhitung, dan notices di antaranya tidak menambah', async () => {
    const db = new TestD1Database();
    await runMiddleware(db, '/api/cbt/attempts/att-1/review');
    expect(readCount(db)).toBe(1);
    await runMiddleware(db, '/api/cbt/attempts/att-1/notices');
    await runMiddleware(db, '/api/cbt/attempts/att-1/notices');
    expect(readCount(db)).toBe(1);
    await runMiddleware(db, '/api/cbt/attempts/att-1/review');
    expect(readCount(db)).toBe(2);
  });

  it('pengecualian sempit: jalur mirip notices tetapi tidak persis tetap terhitung', async () => {
    const db = new TestD1Database();
    await runMiddleware(db, '/api/cbt/attempts/att-1/notices/extra');
    expect(readCount(db)).toBe(1);
    await runMiddleware(db, '/api/cbt/attempts/att-1/noticesx');
    expect(readCount(db)).toBe(2);
  });
});
