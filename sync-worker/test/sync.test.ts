import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailySync, getSyncConfig, postAppsScript, runSync, weeklySync } from '../src/sync';
import type { Env, SyncConfig } from '../src/types';

const liveConfig: SyncConfig = { enabled: true, dryRun: false, batchSize: 10, timeoutMs: 1_000, maxRetries: 0 };

class MemoryStatement {
  private args: unknown[] = [];

  constructor(private db: MemoryD1, private sql: string) {}

  bind(...args: unknown[]) {
    this.args = args;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes('SELECT value FROM app_data')) {
      const value = this.db.appData.get(String(this.args[0]));
      return (value === undefined ? null : { value }) as T | null;
    }
    throw new Error(`Unhandled first SQL: ${this.sql}`);
  }

  async all<T>(): Promise<D1Result<T>> {
    if (this.sql.includes('FROM photos WHERE id IN')) {
      const results = this.args.map(id => this.db.photos.get(String(id))).filter(Boolean) as T[];
      return { results, success: true, meta: {} } as D1Result<T>;
    }
    throw new Error(`Unhandled all SQL: ${this.sql}`);
  }

  async run(): Promise<D1Result> {
    if (this.sql.includes('DELETE FROM app_data') && this.sql.includes('expiresAt')) {
      const current = this.db.appData.get(String(this.args[0]));
      if (current && JSON.parse(current).expiresAt < Number(this.args[1])) this.db.appData.delete(String(this.args[0]));
      return result(0);
    }
    if (this.sql.includes('INSERT OR IGNORE INTO app_data')) {
      const key = String(this.args[0]);
      if (this.db.appData.has(key)) return result(0);
      this.db.appData.set(key, String(this.args[1]));
      return result(1);
    }
    if (this.sql.includes('UPDATE app_data SET value') && this.sql.includes("$.owner")) {
      const key = String(this.args[1]);
      const current = this.db.appData.get(key);
      if (!current || JSON.parse(current).owner !== this.args[2]) return result(0);
      this.db.appData.set(key, String(this.args[0]));
      return result(1);
    }
    if (this.sql.includes('DELETE FROM app_data') && this.sql.includes("$.owner")) {
      const key = String(this.args[0]);
      const current = this.db.appData.get(key);
      if (current && JSON.parse(current).owner === this.args[1]) this.db.appData.delete(key);
      return result(1);
    }
    if (this.sql.includes('INSERT INTO app_data')) {
      this.db.appData.set(String(this.args[0]), String(this.args[1]));
      return result(1);
    }
    if (this.sql.includes('UPDATE photos SET drive_link')) {
      const photo = this.db.photos.get(String(this.args[1]));
      if (photo) Object.assign(photo, { drive_link: this.args[0], pushed: 1 });
      return result(photo ? 1 : 0);
    }
    throw new Error(`Unhandled run SQL: ${this.sql}`);
  }
}

class MemoryD1 {
  appData = new Map<string, string>();
  photos = new Map<string, Record<string, unknown>>();

  constructor(attendance: unknown[]) {
    this.setAttendance(attendance);
  }

  setAttendance(attendance: unknown[]) {
    this.appData.set('presensi_v1', JSON.stringify(attendance));
  }

  prepare(sql: string) {
    return new MemoryStatement(this, sql) as unknown as D1PreparedStatement;
  }
}

function result(changes: number): D1Result {
  return { success: true, results: [], meta: { changes } } as unknown as D1Result;
}

function envFor(db: MemoryD1, extra: Partial<Env> = {}): Env {
  return {
    DB: db as unknown as D1Database,
    APPS_SCRIPT_URL: 'https://example.test',
    SYNC_TOKEN: 'secret',
    ...extra,
  };
}

function attendance(count: number, date = '2026-08-10') {
  return Array.from({ length: count }, (_, index) => ({
    id: `p-${String(index).padStart(2, '0')}`,
    tanggal: date,
    siswaId: `s-${String(index).padStart(2, '0')}`,
    siswaName: `Siswa ${index}`,
    nisn: String(1000 + index),
    classId: 'kelas-a',
    status: 'Hadir',
    waktuInput: '07:00:00',
  }));
}

function successResponse(request: RequestInfo | URL, init?: RequestInit) {
  const body = JSON.parse(String(init?.body));
  return Promise.resolve(new Response(JSON.stringify({
    ok: true,
    results: body.entries.map((entry: { entryId: string }) => ({ ok: true, entryId: entry.entryId, status: 'synced' })),
  })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sync hardening', () => {
  it('is disabled and dry-run by default, without reporting false success', async () => {
    const db = new MemoryD1([]);
    const config = getSyncConfig(envFor(db));
    expect(config).toMatchObject({ enabled: false, dryRun: true, batchSize: 5 });
    const output = await runSync('daily', envFor(db));
    expect(output).toMatchObject({ ok: false, executed: false, status: 'disabled' });
  });

  it('caps batch and retry configuration', () => {
    const config = getSyncConfig(envFor(new MemoryD1([]), { SYNC_BATCH_SIZE: '100', SYNC_MAX_RETRIES: '100' }));
    expect(config.batchSize).toBe(10);
    expect(config.maxRetries).toBe(3);
  });

  it('daily uses stable fingerprints across ordering changes and drains over successive jobs', async () => {
    const records = attendance(12);
    const db = new MemoryD1(records);
    const calls: string[][] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push(body.entries.map((entry: { entryId: string }) => entry.entryId));
      return successResponse(request, init);
    }));

    const first = await dailySync(envFor(db), liveConfig);
    db.setAttendance([...records].reverse());
    const second = await dailySync(envFor(db), liveConfig);
    db.setAttendance(records.map(record => record.id === 'p-00' ? { ...record, status: 'Izin' } : record));
    const changed = await dailySync(envFor(db), liveConfig);

    expect(first).toMatchObject({ ok: true, processed: 10, pending: 2, checkpointAdvanced: true });
    expect(second).toMatchObject({ ok: true, processed: 2, pending: 0, checkpointAdvanced: true });
    expect(changed).toMatchObject({ ok: true, processed: 1, pending: 0, checkpointAdvanced: true });
    expect(calls[0]).toEqual(records.slice(0, 10).map(record => record.id));
    expect(calls[1]).toEqual(records.slice(10).map(record => record.id));
    expect(calls[2]).toEqual(['p-00']);
  });

  it('daily does not advance durable state on a partial result and retries the same keys', async () => {
    const db = new MemoryD1(attendance(3));
    const calls: string[][] = [];
    const fetcher = vi.fn(async (_request: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const ids = body.entries.map((entry: { entryId: string }) => entry.entryId);
      calls.push(ids);
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'invalid attendance date',
          results: ids.map((entryId: string, index: number) => ({ ok: index !== 2, entryId, error: index === 2 ? 'invalid attendance date' : undefined })),
        }));
      }
      return successResponse(_request, init);
    });
    vi.stubGlobal('fetch', fetcher);

    const failed = await dailySync(envFor(db), liveConfig);
    const stateAfterFailure = db.appData.get('google_sync_state_v2');
    const retried = await dailySync(envFor(db), liveConfig);

    expect(failed).toMatchObject({ ok: false, checkpointAdvanced: false });
    expect(stateAfterFailure).toBeUndefined();
    expect(retried).toMatchObject({ ok: true, checkpointAdvanced: true });
    expect(calls[1]).toEqual(calls[0]);
  });

  it('weekly drains every student in batches no larger than ten', async () => {
    const db = new MemoryD1(attendance(23));
    const sizes: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      sizes.push(JSON.parse(String(init?.body)).entries.length);
      return successResponse(request, init);
    }));

    const output = await weeklySync(envFor(db), liveConfig, new Date('2026-08-15T00:00:00Z'));
    expect(output).toMatchObject({ ok: true, total: 23, processed: 23, succeeded: 23 });
    expect(sizes).toEqual([10, 10, 3]);
  });

  it('weekly stops on a partial batch instead of advancing to later students', async () => {
    const db = new MemoryD1(attendance(23));
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      call++;
      if (call === 2) {
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          ok: false,
          error: 'invalid attendance date',
          results: body.entries.map((entry: { entryId: string }, index: number) => ({ ok: index !== 9, entryId: entry.entryId })),
        }));
      }
      return successResponse(request, init);
    }));

    const output = await weeklySync(envFor(db), liveConfig, new Date('2026-08-15T00:00:00Z'));
    expect(output).toMatchObject({ ok: false, processed: 20, checkpointAdvanced: false });
    expect(call).toBe(2);
  });

  it('retries transient json.ok=false, non-JSON, and incomplete success responses', async () => {
    const entries = [{ entryId: 'p-1' }];
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{"ok":false,"error":"sync locked","results":[]}'))
      .mockResolvedValueOnce(new Response('<html>temporary</html>'))
      .mockResolvedValueOnce(new Response('{"ok":true,"results":[]}'))
      .mockResolvedValueOnce(new Response('{"ok":true,"results":[{"ok":true,"entryId":"p-1"}]}'));
    const output = await postAppsScript(
      envFor(new MemoryD1([])),
      { action: 'daily', entries },
      { ...liveConfig, maxRetries: 3 },
      fetcher,
    );
    expect(output.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('allows only one concurrent run to hold the D1 lease', async () => {
    const db = new MemoryD1(attendance(1));
    let releaseFetch!: () => void;
    const gate = new Promise<void>(resolve => { releaseFetch = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      await gate;
      return successResponse(request, init);
    }));
    const env = envFor(db, { SYNC_ENABLED: 'true', SYNC_DRY_RUN: 'false' });

    const firstPromise = runSync('daily', env);
    await vi.waitFor(() => expect(db.appData.has('google_sync_lock_v1')).toBe(true));
    const second = await runSync('daily', env);
    releaseFetch();
    const first = await firstPromise;

    expect(second).toMatchObject({ ok: false, executed: false, status: 'locked' });
    expect(first).toMatchObject({ ok: true, executed: true, status: 'completed' });
  });
});
