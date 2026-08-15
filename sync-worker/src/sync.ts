import { Env } from './types';

interface PresensiRecord {
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
  data: string | null;
  mime: string;
}

interface AppsScriptResult {
  photoId?: string;
  driveLink?: string;
}

/**
 * JOB HARIAN: pindahkan foto full (base64 di D1) ke Google Drive via Apps Script,
 * tulis baris di tabel "Harian", lalu kosongkan `data` (thumb tetap di D1).
 */
export async function dailySync(env: Env): Promise<unknown> {
  await env.DB.prepare(`
    DELETE FROM photos
    WHERE pushed = 0
      AND created_at < datetime('now', '-1 day')
      AND NOT EXISTS (
        SELECT 1 FROM app_data, json_each(app_data.value) AS attendance
        WHERE app_data.key = 'presensi_v1'
          AND json_extract(attendance.value, '$.fotoUrl') = '/api/photo/' || photos.id
      )
  `).run();
  const photos = await env.DB
    .prepare(
      `SELECT photos.id, photos.data, photos.mime
       FROM photos, app_data
       WHERE app_data.key = 'presensi_v1'
         AND photos.pushed = 0
         AND photos.data IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM json_each(app_data.value) AS attendance
           WHERE json_extract(attendance.value, '$.fotoUrl') = '/api/photo/' || photos.id
         )
       ORDER BY photos.created_at ASC LIMIT 300`
    )
    .all<PhotoRow>();

  if (!photos.results.length) {
    return { action: 'daily', pushed: 0, skipped: true };
  }

  const row = await env.DB
    .prepare('SELECT value FROM app_data WHERE key = ?')
    .bind('presensi_v1')
    .first<{ value: string }>();

  let presensi: PresensiRecord[] = [];
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) presensi = parsed;
    } catch {
      // abaikan data rusak
    }
  }

  const recByPhoto = new Map<string, PresensiRecord>();
  for (const r of presensi) {
    if (r.fotoUrl && r.fotoUrl.startsWith('/api/photo/')) {
      const id = r.fotoUrl.slice('/api/photo/'.length);
      recByPhoto.set(id, r);
    }
  }

  const entries = photos.results
    .filter(p => p.data && recByPhoto.has(p.id))
    .map(p => {
      const r = recByPhoto.get(p.id)!;
      return {
        photoId: p.id,
        tanggal: r.tanggal || '',
        kelas: r.classId || '',
        nisn: r.nisn || '',
        siswaName: r.siswaName || '?',
        status: r.status || '',
        keterangan: r.keterangan || '',
        waktu: r.waktuInput || '',
        fotoBase64: p.data!,
        mime: p.mime || 'image/jpeg',
      };
    });

  if (!entries.length) return { action: 'daily', pushed: 0, skipped: true };

  const resp = await postAppsScript(env, { action: 'daily', token: env.SYNC_TOKEN, entries });

  let pushed = 0;
  if (resp?.ok === true && Array.isArray(resp.results)) {
    for (const r of resp.results as AppsScriptResult[]) {
      if (!r || !r.photoId) continue;
      await env.DB
        .prepare('UPDATE photos SET drive_link = ?, pushed = 1, data = NULL WHERE id = ?')
        .bind(r.driveLink || null, r.photoId)
        .run();
      pushed++;
    }
  }

  return {
    action: 'daily',
    total: entries.length,
    pushed,
    ok: resp?.ok === true,
    error: resp?.ok === true ? undefined : resp?.error || 'apps script error',
  };
}

/**
 * JOB MINGGUAN: buat tabel "Rekap" (7 hari terakhir, waktu WIB) + pastikan
 * folder Drive per siswa minggu tersebut ada. Tidak menghapus data D1.
 */
export async function weeklySync(env: Env): Promise<unknown> {
  const row = await env.DB
    .prepare('SELECT value FROM app_data WHERE key = ?')
    .bind('presensi_v1')
    .first<{ value: string }>();

  let presensi: PresensiRecord[] = [];
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) presensi = parsed;
    } catch {
      // abaikan
    }
  }

  // WIB = UTC+7; tanggal yang disimpan di D1 adalah tanggal lokal perangkat (WIB)
  const wibNow = new Date(Date.now() + 7 * 3600 * 1000);
  const weekEnd = isoDateWib(addDays(wibNow, -1));
  const weekStart = isoDateWib(addDays(wibNow, -7));
  const weekLabel = `${weekStart} s/d ${weekEnd}`;

  const inWindow = presensi.filter(r => r.tanggal && r.tanggal >= weekStart && r.tanggal <= weekEnd);

  const byStudent = new Map<string, {
    siswaId: string; nama: string; nisn: string; kelas: string;
    hadir: number; sakit: number; izin: number; alpa: number;
  }>();
  for (const r of inWindow) {
    const key = r.siswaId || r.nisn || r.id || 'unknown';
    const s = byStudent.get(key) || {
      siswaId: key, nama: r.siswaName || '', nisn: r.nisn || '', kelas: r.classId || '',
      hadir: 0, sakit: 0, izin: 0, alpa: 0,
    };
    if (r.status === 'Hadir') s.hadir++;
    else if (r.status === 'Sakit') s.sakit++;
    else if (r.status === 'Izin') s.izin++;
    else if (r.status === 'Alpa') s.alpa++;
    byStudent.set(key, s);
  }

  const entries = Array.from(byStudent.values()).map(({ siswaId, ...rest }) => rest);

  const resp = await postAppsScript(env, {
    action: 'weekly',
    token: env.SYNC_TOKEN,
    weekLabel,
    weekStart,
    weekEnd,
    entries,
  });

  return {
    action: 'weekly',
    entries: entries.length,
    ok: resp?.ok === true,
    error: resp?.ok === true ? undefined : resp?.error || 'apps script error',
  };
}

async function postAppsScript(env: Env, body: unknown): Promise<any> {
  const res = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { ok: false, error: `Apps Script tidak membalas JSON: ${text.slice(0, 200)}` };
  }
  if (!res.ok) json = { ...json, ok: false, http: res.status };
  return json;
}

function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd;
}

/** Format tanggal dari komponen UTC pada objek yang sudah digeser ke WIB. */
function isoDateWib(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
