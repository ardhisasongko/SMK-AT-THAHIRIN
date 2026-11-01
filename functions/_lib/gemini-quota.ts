/**
 * Kuota AI per deployment (hardening Fase D).
 *
 * Setiap deployment sekolah berbagi SATU kunci Gemini dan SATU anggaran:
 * tanpa batas tingkat deployment, satu pengguna berat (atau skrip) dapat
 * menghabiskan kuota Gemini sekolah untuk semua orang. Penghitung harian
 * disimpan di D1 (`gemini_daily_usage`, hari kalender WIB) dan dinaikkan
 * atomik oleh setiap panggilan endpoint AI (generate CBT, Modul Ajar).
 *
 * Batas dibaca dari env `GEMINI_DAILY_LIMIT`:
 *   - kosong / 0 / tidak valid = TANPA batas (perilaku bawaan; deployment
 *     lama tidak berubah sama sekali selain penghitung yang berjalan).
 *   - N > 0 = permintaan ke-(N+1) hari itu ditolak 429 sampai besok WIB.
 *
 * Penghitung FAIL-OPEN dengan console.error bila D1 bermasalah (mis.
 * migrasi 0032 belum diterapkan): fitur AI tidak boleh mati total hanya
 * karena tabel penghitung belum ada; batas per pengguna 20/hari yang
 * sudah ada tetap berjalan sebagai lapisan lain.
 */

export interface GeminiQuotaEnv {
  GEMINI_DAILY_LIMIT?: string;
}

export interface GeminiQuotaStatus {
  day: string;
  used: number;
  limit: number;
}

/** Hari kalender WIB (UTC+7) dalam format YYYY-MM-DD. */
export function wibDayString(now: Date = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wib.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse batas harian; nilai kosong/tidak valid/negatif = 0 (tanpa batas). */
export function parseGeminiDailyLimit(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/**
 * Naikkan penghitung hari ini dan putuskan apakah permintaan boleh jalan.
 * Penghitung menaik SEBELUM keputusan, sehingga percobaan yang ditolak
 * pun tercatat — angka panel status mencerminkan beban percobaan nyata.
 */
export async function consumeGeminiQuota(
  db: D1Database,
  env: GeminiQuotaEnv,
  now: Date = new Date(),
): Promise<GeminiQuotaStatus & { allowed: boolean }> {
  const day = wibDayString(now);
  const limit = parseGeminiDailyLimit(env.GEMINI_DAILY_LIMIT);
  try {
    const row = await db.prepare(`
      INSERT INTO gemini_daily_usage (day, request_count, updated_at)
      VALUES (?, 1, ?)
      ON CONFLICT(day) DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at
      RETURNING request_count
    `).bind(day, now.toISOString()).first<{ request_count: number }>();
    const used = Number(row?.request_count || 0);
    return { day, used, limit, allowed: limit === 0 || used <= limit };
  } catch (error) {
    console.error('Gagal mencatat kuota AI harian (fail-open):', error);
    return { day, used: 0, limit, allowed: true };
  }
}

/** Status kuota hari ini tanpa menaikkan penghitung (panel status Fase E). */
export async function getGeminiQuotaStatus(
  db: D1Database,
  env: GeminiQuotaEnv,
  now: Date = new Date(),
): Promise<GeminiQuotaStatus> {
  const day = wibDayString(now);
  const limit = parseGeminiDailyLimit(env.GEMINI_DAILY_LIMIT);
  try {
    const row = await db.prepare('SELECT request_count FROM gemini_daily_usage WHERE day = ?')
      .bind(day).first<{ request_count: number }>();
    return { day, used: Number(row?.request_count || 0), limit };
  } catch (error) {
    console.error('Gagal membaca kuota AI harian (fail-open):', error);
    return { day, used: 0, limit };
  }
}
