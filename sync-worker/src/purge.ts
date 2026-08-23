import type { Env } from './types';

export interface PurgeResult extends Record<string, unknown> {
  ok: boolean;
  sessionsDeleted: number;
  rateLimitsDeleted: number;
  photoBlobsCleared: number;
  error?: string;
}

/**
 * Pembersihan berkala D1 (hemat storage & rows free tier):
 * 1. Sesi login kedaluwarsa — sebelumnya tidak pernah dibersihkan.
 * 2. Counter rate limit kedaluwarsa — safety net penuh (jalur harian hanya
 *    menghapus 32 baris terlama per request).
 * 3. Blob foto FULL yang sudah diarsipkan ke Drive (>24 jam) dikosongkan —
 *    sesuai janji desain migrasi 0004; thumbnail tetap tersimpan untuk UI.
 */
export async function runPurge(env: Env): Promise<PurgeResult> {
  const db = env.DB;

  // Cutoff ganda: penulis selalu memakai ISO (toISOString), tapi format
  // datetime('now') SQLite dipakai sebagai default kolom — bandingkan keduanya.
  const isoCutoff = new Date().toISOString();
  const dtCutoff = isoCutoff.replace('T', ' ').slice(0, 19);

  const sessions = await db.prepare(
    'DELETE FROM sessions WHERE expires_at < ? OR expires_at < ?'
  ).bind(isoCutoff, dtCutoff).run();

  const rateLimits = await db.prepare(
    'DELETE FROM api_rate_limits WHERE window_expires < ?'
  ).bind(Math.floor(Date.now() / 1000)).run();

  const photoBlobs = await db.prepare(
    `UPDATE photos SET data = NULL
      WHERE pushed = 1 AND drive_link IS NOT NULL AND data IS NOT NULL
        AND created_at < datetime('now', '-24 hours')`
  ).run();

  return {
    ok: true,
    sessionsDeleted: Number(sessions.meta?.changes || 0),
    rateLimitsDeleted: Number(rateLimits.meta?.changes || 0),
    photoBlobsCleared: Number(photoBlobs.meta?.changes || 0),
  };
}
