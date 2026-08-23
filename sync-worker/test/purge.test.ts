// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runPurge } from '../src/purge';
import type { Env } from '../src/types';

class TestD1 {
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(query: string) {
    const statement = this.sqlite.prepare(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let values: any[] = [];
    const prepared = {
      bind: (...bindings: unknown[]) => { values = bindings; return prepared; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
    };
    return prepared;
  }
}

function buildDb(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  const apply = (file: string) => sqlite.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), 'utf8'));
  apply('0002_auth.sql');
  apply('0011_api_rate_limits.sql');
  apply('0014_rate_limit_expiration.sql');
  apply('0003_photos.sql');
  apply('0004_photos_v2.sql');
  apply('0025_photos_data_nullable.sql');
  return sqlite;
}

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const HOUR = 3600 * 1000;

describe('runPurge', () => {
  it('membersihkan sesi kedaluwarsa, rate limit mati, dan blob foto terarsip — sisanya utuh', async () => {
    const sqlite = buildDb();

    // Sesi: satu kedaluwarsa, satu aktif.
    sqlite.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES ('tok-lama','u1',?)").run(iso(-2 * HOUR));
    sqlite.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES ('tok-aktif','u1',?)").run(iso(6 * DAY));
    // Rate limit: satu kedaluwarsa, satu hidup.
    const nowSec = Math.floor(Date.now() / 1000);
    sqlite.prepare('INSERT INTO api_rate_limits (key, window_started, request_count, window_expires) VALUES (?,?,?,?)')
      .run('rl-mati', nowSec - 3600, 5, nowSec - 1800);
    sqlite.prepare('INSERT INTO api_rate_limits (key, window_started, request_count, window_expires) VALUES (?,?,?,?)')
      .run('rl-hidup', nowSec - 10, 5, nowSec + 300);
    // Foto: (a) terarsip lama -> blob dikosongkan; (b) belum dipush -> utuh;
    // (c) terarsip tapi masih segar (<24 jam) -> utuh.
    const insertPhoto = sqlite.prepare(
      "INSERT INTO photos (id, data, mime, thumb, drive_link, pushed, created_at) VALUES (?, 'BLOB64', 'image/jpeg', 'THUMB', ?, ?, ?)"
    );
    insertPhoto.run('p-lama', 'https://drive.example/a', 1, new Date(Date.now() - 48 * HOUR).toISOString().replace('T', ' ').slice(0, 19));
    insertPhoto.run('p-baru-push0', null as unknown as string, 0, new Date(Date.now() - 48 * HOUR).toISOString().replace('T', ' ').slice(0, 19));
    insertPhoto.run('p-segar', 'https://drive.example/c', 1, new Date(Date.now() - 1 * HOUR).toISOString().replace('T', ' ').slice(0, 19));

    const result = await runPurge({ DB: new TestD1(sqlite) } as unknown as Env);

    expect(result).toMatchObject({ ok: true, sessionsDeleted: 1, rateLimitsDeleted: 1, photoBlobsCleared: 1 });
    expect(sqlite.prepare("SELECT count(*) AS c FROM sessions WHERE token='tok-aktif'").get()?.c).toBe(1);
    expect(sqlite.prepare("SELECT count(*) AS c FROM sessions WHERE token='tok-lama'").get()?.c).toBe(0);
    expect(sqlite.prepare("SELECT count(*) AS c FROM api_rate_limits WHERE key='rl-hidup'").get()?.c).toBe(1);
    expect(sqlite.prepare("SELECT data AS d FROM photos WHERE id='p-lama'").get()?.d).toBeNull();
    // Thumbnail tidak pernah hilang.
    expect(sqlite.prepare("SELECT thumb AS t FROM photos WHERE id='p-lama'").get()?.t).toBe('THUMB');
    expect(sqlite.prepare("SELECT data AS d FROM photos WHERE id='p-baru-push0'").get()?.d).toBe('BLOB64');
    expect(sqlite.prepare("SELECT data AS d FROM photos WHERE id='p-segar'").get()?.d).toBe('BLOB64');
  });

  it('idempoten: menjalankan dua kali aman', async () => {
    const sqlite = buildDb();
    sqlite.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES ('t','u1',?)").run(iso(-HOUR));
    const env = { DB: new TestD1(sqlite) } as unknown as Env;
    const first = await runPurge(env);
    const second = await runPurge(env);
    expect(first.sessionsDeleted).toBe(1);
    expect(second.sessionsDeleted).toBe(0);
  });
});

const DAY = 24 * HOUR;
