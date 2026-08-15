// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRateLimit, consumeRateLimit } from '../functions/_lib/rate-limit';

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

  run(query: string, ...values: unknown[]) {
    return this.sqlite.prepare(query).run(...values);
  }
}

describe('rate limiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows no more than the limit under parallel requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-15T00:00:00Z');
    const db = new TestD1Database();

    const results = await Promise.all(
      Array.from({ length: 50 }, () => consumeRateLimit(db as unknown as D1Database, 'parallel', 10, 60)),
    );

    expect(results.filter(Boolean)).toHaveLength(10);
    expect(db.get<{ request_count: number }>('SELECT request_count FROM api_rate_limits WHERE key=?', 'parallel')?.request_count).toBe(10);
  });

  it('rejects at the limit and starts a fresh counter after expiration', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-15T00:00:00Z');
    const db = new TestD1Database();
    const d1 = db as unknown as D1Database;

    expect(await consumeRateLimit(d1, 'window', 2, 60)).toBe(true);
    expect(await consumeRateLimit(d1, 'window', 2, 60)).toBe(true);
    expect(await consumeRateLimit(d1, 'window', 2, 60)).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(await consumeRateLimit(d1, 'window', 2, 60)).toBe(true);
    expect(db.get<{ request_count: number }>('SELECT request_count FROM api_rate_limits WHERE key=?', 'window')?.request_count).toBe(1);
  });

  it('clears a counter explicitly', async () => {
    const db = new TestD1Database();
    const d1 = db as unknown as D1Database;

    await consumeRateLimit(d1, 'clear-me', 1, 60);
    await clearRateLimit(d1, 'clear-me');

    expect(await consumeRateLimit(d1, 'clear-me', 1, 60)).toBe(true);
  });

  it('removes expired rows in bounded batches without deleting active windows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-15T00:00:00Z');
    const now = Math.floor(Date.now() / 1000);
    const db = new TestD1Database();
    const insert = 'INSERT INTO api_rate_limits (key,window_started,request_count,window_expires) VALUES (?,?,?,?)';

    for (let index = 0; index < 40; index += 1) db.run(insert, `expired-${index}`, now - 120, 1, now - 60);
    db.run(insert, 'active', now, 1, now + 3600);

    await consumeRateLimit(db as unknown as D1Database, 'request', 5, 60);

    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM api_rate_limits WHERE window_expires<=?', now)?.count).toBe(8);
    expect(db.get('SELECT key FROM api_rate_limits WHERE key=?', 'active')).toBeDefined();
  });
});
