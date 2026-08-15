import { Env, JobName, JobResult, SyncConfig } from './types';

export interface PresensiRecord {
  id?: string;
  tanggal?: string;
  classId?: string;
  siswaId?: string;
  siswaName?: string;
  nisn?: string;
  status?: string;
  keterangan?: string;
  waktuInput?: string;
  fotoUrl?: string;
}

interface PhotoRow {
  id: string;
  data: string;
  mime: string;
  drive_link: string | null;
  pushed: number;
}

interface EntryResult {
  entryId?: string;
  photoId?: string;
  driveLink?: string;
  fileId?: string;
  status?: string;
  ok?: boolean;
  error?: string;
}

interface SyncState {
  dailyApplied?: Record<string, string>;
}

interface AppsScriptResponse {
  ok?: boolean;
  results?: EntryResult[];
  error?: string;
  http?: number;
}

interface DailyCandidate {
  key: string;
  fingerprint: string;
  record: PresensiRecord;
}

const STATE_KEY = 'google_sync_state_v2';
const LOCK_KEY = 'google_sync_lock_v1';
const STATUS_KEY = 'google_sync_status_v1';
const LOCK_TTL_MS = 5 * 60_000;

export function getSyncConfig(env: Env): SyncConfig {
  return {
    enabled: env.SYNC_ENABLED === 'true',
    dryRun: env.SYNC_DRY_RUN !== 'false',
    batchSize: clampInteger(env.SYNC_BATCH_SIZE, 5, 1, 10),
    timeoutMs: clampInteger(env.SYNC_TIMEOUT_MS, 10_000, 1_000, 30_000),
    maxRetries: clampInteger(env.SYNC_MAX_RETRIES, 2, 0, 3),
  };
}

export async function runSync(job: JobName, env: Env): Promise<JobResult> {
  const config = getSyncConfig(env);
  const startedAt = new Date().toISOString();
  if (!config.enabled) {
    const result: JobResult = {
      ok: false,
      executed: false,
      job,
      status: 'disabled',
      dryRun: config.dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: 'Sync is disabled by configuration',
    };
    try {
      await writeStatus(env, result);
      result.statusPersisted = true;
    } catch (error) {
      result.statusPersisted = false;
      result.statusError = error instanceof Error ? error.message : String(error);
    }
    return result;
  }

  const owner = crypto.randomUUID();
  if (!(await acquireLock(env, owner))) {
    return { ok: false, executed: false, job, status: 'locked', dryRun: config.dryRun, startedAt, finishedAt: new Date().toISOString() };
  }

  const heartbeat = () => refreshLock(env, owner);
  try {
    await writeStatus(env, { ok: false, executed: true, job, status: 'running', dryRun: config.dryRun, startedAt });
    const details = job === 'daily'
      ? await dailySync(env, config, heartbeat)
      : await weeklySync(env, config, new Date(), heartbeat);
    const result: JobResult = {
      ...details,
      ok: details.ok,
      executed: true,
      job,
      status: details.ok ? (config.dryRun ? 'dry-run' : 'completed') : 'partial',
      dryRun: config.dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
    await writeStatus(env, result);
    return result;
  } catch (error) {
    const result: JobResult = {
      ok: false,
      executed: true,
      job,
      status: 'failed',
      dryRun: config.dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
    await writeStatus(env, result);
    return result;
  } finally {
    await releaseLock(env, owner);
  }
}

export async function dailySync(
  env: Env,
  config = getSyncConfig(env),
  heartbeat?: () => Promise<void>,
): Promise<Record<string, unknown> & { ok: boolean }> {
  const attendance = await readAttendance(env);
  const state = await readState(env);
  const candidates = await buildDailyCandidates(attendance);
  const pending = candidates.filter(candidate => state.dailyApplied?.[candidate.key] !== candidate.fingerprint);
  const batch = pending.slice(0, config.batchSize);
  if (!batch.length) return { ok: true, total: attendance.length, pending: 0, processed: 0, skipped: true };
  if (config.dryRun) {
    return { ok: true, total: attendance.length, pending: pending.length, processed: 0, planned: batch.length };
  }

  await heartbeat?.();
  const photoIds = batch.map(item => photoIdFromRecord(item.record)).filter((id): id is string => Boolean(id));
  const photos = await readPhotos(env, photoIds);
  const entries = batch.map(({ key, record }) => {
    const photoId = photoIdFromRecord(record);
    const photo = photoId ? photos.get(photoId) : undefined;
    return {
      entryId: key,
      tanggal: record.tanggal || '',
      kelas: record.classId || '',
      nisn: record.nisn || '',
      siswaId: record.siswaId || '',
      siswaName: record.siswaName || '',
      status: record.status || '',
      keterangan: record.keterangan || '',
      waktu: record.waktuInput || '',
      photoId,
      fotoBase64: photo?.pushed ? undefined : photo?.data,
      mime: photo?.mime || 'image/jpeg',
      driveLink: photo?.drive_link || undefined,
    };
  });
  const response = await postAppsScript(env, { action: 'daily', entries }, config);
  const results = Array.isArray(response.results) ? response.results : [];
  const complete = response.ok === true && hasSuccessfulResults(entries.map(entry => entry.entryId), results);
  if (!complete) {
    return {
      ok: false,
      total: attendance.length,
      pending: pending.length,
      processed: entries.length,
      succeeded: results.filter(result => result.ok).length,
      failed: entries.length - results.filter(result => result.ok).length,
      checkpointAdvanced: false,
      error: response.error || 'Apps Script returned a partial or invalid result',
    };
  }

  for (const result of results) {
    if (result.photoId && result.driveLink && result.fileId && result.status === 'verified') {
      await markPhotoSynced(env, result.photoId, result.driveLink);
    }
  }
  const dailyApplied = { ...(state.dailyApplied || {}) };
  for (const candidate of batch) dailyApplied[candidate.key] = candidate.fingerprint;
  await writeState(env, { dailyApplied });
  return {
    ok: true,
    total: attendance.length,
    pending: pending.length - batch.length,
    processed: entries.length,
    succeeded: entries.length,
    failed: 0,
    checkpointAdvanced: true,
  };
}

export async function weeklySync(
  env: Env,
  config = getSyncConfig(env),
  now = new Date(),
  heartbeat?: () => Promise<void>,
): Promise<Record<string, unknown> & { ok: boolean }> {
  const attendance = await readAttendance(env);
  const wibNow = new Date(now.getTime() + 7 * 3_600_000);
  const weekEnd = isoDateWib(addDays(wibNow, -1));
  const weekStart = isoDateWib(addDays(wibNow, -7));
  const weekLabel = `${weekStart} s/d ${weekEnd}`;
  const summaries = summarizeWeek(attendance, weekStart, weekEnd);
  if (!summaries.length) return { ok: true, total: 0, processed: 0, skipped: true, weekLabel };
  if (config.dryRun) return { ok: true, total: summaries.length, processed: 0, planned: summaries.length, weekLabel };

  let processed = 0;
  for (let offset = 0; offset < summaries.length; offset += config.batchSize) {
    await heartbeat?.();
    const entries = summaries.slice(offset, offset + config.batchSize);
    const response = await postAppsScript(env, { action: 'weekly', weekLabel, weekStart, weekEnd, entries }, config);
    const results = Array.isArray(response.results) ? response.results : [];
    const succeeded = results.filter(result => result.ok).length;
    processed += entries.length;
    if (response.ok !== true || !hasSuccessfulResults(entries.map(entry => entry.entryId), results)) {
      return {
        ok: false,
        total: summaries.length,
        processed,
        succeeded: offset + succeeded,
        failed: entries.length - succeeded,
        remaining: summaries.length - offset,
        checkpointAdvanced: false,
        weekLabel,
        error: response.error || 'Apps Script returned a partial or invalid result',
      };
    }
  }
  return { ok: true, total: summaries.length, processed, succeeded: processed, failed: 0, weekLabel };
}

export async function postAppsScript(
  env: Env,
  body: Record<string, unknown>,
  config = getSyncConfig(env),
  fetcher: typeof fetch = fetch,
): Promise<AppsScriptResponse> {
  let last: AppsScriptResponse = { ok: false, error: 'Apps Script request failed' };
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let retry = true;
    try {
      const response = await fetcher(env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token: env.SYNC_TOKEN }),
        signal: controller.signal,
      });
      const text = await response.text();
      let json: AppsScriptResponse | undefined;
      try {
        json = JSON.parse(text) as AppsScriptResponse;
      } catch {
        last = { ok: false, http: response.status, error: `Apps Script returned non-JSON: ${text.slice(0, 200)}` };
      }
      if (json && typeof json.ok !== 'boolean') {
        last = { ok: false, http: response.status, error: 'Apps Script response is missing boolean ok' };
      } else if (json) {
        last = { ...json, http: response.ok ? undefined : response.status };
        if (response.ok && json.ok === true && isResponseShapeValid(body, json)) return json;
        if (response.ok && json.ok === true) {
          last = { ...last, ok: false, error: 'Apps Script result set is incomplete or invalid' };
        } else {
          retry = response.status === 429 || response.status >= 500 || isTransientScriptError(json);
          if (!retry) return last;
        }
      }
    } catch (error) {
      last = { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
    if (!retry) return last;
    if (attempt < config.maxRetries) await delay(Math.min(250 * 2 ** attempt, 1_000));
  }
  return last;
}

export async function buildDailyCandidates(records: PresensiRecord[]): Promise<DailyCandidate[]> {
  const seen = new Set<string>();
  const candidates = await Promise.all(records.map(async record => {
    const key = stableAttendanceKey(record);
    if (seen.has(key)) throw new Error(`Duplicate stable attendance key: ${key}`);
    seen.add(key);
    return { key, fingerprint: await sha256(canonicalAttendance(record)), record };
  }));
  return candidates.sort((left, right) => left.key.localeCompare(right.key));
}

function isResponseShapeValid(body: Record<string, unknown>, response: AppsScriptResponse): boolean {
  const entries = Array.isArray(body.entries) ? body.entries as Array<{ entryId?: string }> : [];
  return Array.isArray(response.results) && hasSuccessfulResults(entries.map(entry => String(entry.entryId || '')), response.results);
}

function hasSuccessfulResults(expected: string[], results: EntryResult[]): boolean {
  if (results.length !== expected.length) return false;
  const actual = new Set(results.filter(result => result?.ok === true).map(result => result.entryId));
  return actual.size === expected.length && expected.every(id => Boolean(id) && actual.has(id));
}

function isTransientScriptError(response: AppsScriptResponse): boolean {
  const errors = [response.error, ...(response.results || []).map(result => result.error)].filter(Boolean).join(' ');
  if (/invalid token|unknown action|required|invalid attendance|payload is unavailable|identity is incomplete/i.test(errors)) return false;
  return true;
}

async function readAttendance(env: Env): Promise<PresensiRecord[]> {
  const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?').bind('presensi_v1').first<{ value: string }>();
  if (!row) return [];
  try {
    const parsed: unknown = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed as PresensiRecord[] : [];
  } catch {
    throw new Error('presensi_v1 contains invalid JSON');
  }
}

async function readPhotos(env: Env, ids: string[]): Promise<Map<string, PhotoRow>> {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT id, data, mime, drive_link, pushed FROM photos WHERE id IN (${placeholders})`,
  ).bind(...ids).all<PhotoRow>();
  return new Map(rows.results.map(row => [row.id, row]));
}

async function markPhotoSynced(env: Env, photoId: string, driveLink: string): Promise<void> {
  await env.DB.prepare('UPDATE photos SET drive_link = ?, pushed = 1 WHERE id = ?').bind(driveLink, photoId).run();
}

async function acquireLock(env: Env, owner: string): Promise<boolean> {
  await env.DB.prepare(
    `DELETE FROM app_data WHERE key = ? AND CAST(json_extract(value, '$.expiresAt') AS INTEGER) < ?`,
  ).bind(LOCK_KEY, Date.now()).run();
  const lock = JSON.stringify({ owner, expiresAt: Date.now() + LOCK_TTL_MS });
  const result = await env.DB.prepare('INSERT OR IGNORE INTO app_data (key, value) VALUES (?, ?)').bind(LOCK_KEY, lock).run();
  return Number(result.meta.changes || 0) === 1;
}

async function refreshLock(env: Env, owner: string): Promise<void> {
  const lock = JSON.stringify({ owner, expiresAt: Date.now() + LOCK_TTL_MS });
  const result = await env.DB.prepare(
    `UPDATE app_data SET value = ?, updated_at = unixepoch() WHERE key = ? AND json_extract(value, '$.owner') = ?`,
  ).bind(lock, LOCK_KEY, owner).run();
  if (Number(result.meta.changes || 0) !== 1) throw new Error('Sync lock lease was lost');
}

async function releaseLock(env: Env, owner: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM app_data WHERE key = ? AND json_extract(value, '$.owner') = ?`).bind(LOCK_KEY, owner).run();
}

async function readState(env: Env): Promise<SyncState> {
  const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?').bind(STATE_KEY).first<{ value: string }>();
  if (!row) return {};
  try { return JSON.parse(row.value) as SyncState; } catch { return {}; }
}

async function writeState(env: Env, state: SyncState): Promise<void> {
  await upsertAppData(env, STATE_KEY, state);
}

async function writeStatus(env: Env, status: JobResult): Promise<void> {
  await upsertAppData(env, STATUS_KEY, status);
}

async function upsertAppData(env: Env, key: string, value: unknown): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO app_data (key, value, updated_at) VALUES (?, ?, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
  ).bind(key, JSON.stringify(value)).run();
}

function stableAttendanceKey(record: PresensiRecord): string {
  if (record.id) return String(record.id);
  const student = record.siswaId || record.nisn;
  if (!record.tanggal || !student) throw new Error('Attendance requires id or tanggal plus siswaId/nisn');
  return `${record.tanggal}:${student}`;
}

function canonicalAttendance(record: PresensiRecord): string {
  return JSON.stringify({
    tanggal: record.tanggal || '', classId: record.classId || '', siswaId: record.siswaId || '',
    siswaName: record.siswaName || '', nisn: record.nisn || '', status: record.status || '',
    keterangan: record.keterangan || '', waktuInput: record.waktuInput || '', fotoUrl: record.fotoUrl || '',
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function photoIdFromRecord(record: PresensiRecord): string | undefined {
  const prefix = '/api/photo/';
  return record.fotoUrl?.startsWith(prefix) ? record.fotoUrl.slice(prefix.length).split('?')[0] : undefined;
}

function summarizeWeek(records: PresensiRecord[], start: string, end: string) {
  const students = new Map<string, { entryId: string; nama: string; nisn: string; kelas: string; hadir: number; terlambat: number; sakit: number; izin: number; alpa: number }>();
  for (const record of records) {
    if (!record.tanggal || record.tanggal < start || record.tanggal > end) continue;
    const key = record.siswaId || record.nisn || record.id;
    if (!key) continue;
    const item = students.get(key) || { entryId: key, nama: record.siswaName || '', nisn: record.nisn || '', kelas: record.classId || '', hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0 };
    const field = record.status?.toLowerCase() as 'hadir' | 'terlambat' | 'sakit' | 'izin' | 'alpa';
    if (field in item && typeof item[field] === 'number') item[field]++;
    students.set(key, item);
  }
  return Array.from(students.values()).sort((left, right) => left.entryId.localeCompare(right.entryId));
}

function clampInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDateWib(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
