/**
 * Lockout login bertahap (hardening Fase C) — lapisan di atas rate limit
 * jendela geser yang sudah ada di `api_rate_limits`.
 *
 * Model: setiap kunci ('account:<identifier>' / 'ip:<ip>') menghitung
 * kegagalan BERUNTUN. Mencapai ambang mengunci kunci dengan durasi yang
 * naik per level: 5 → 15 → 60 → 240 → 1440 menit (maks. 1 hari, tidak
 * pernah permanen). Login berhasil menghapus baris akun; reset password
 * oleh admin juga menghapusnya (jalan pemulihan resmi). Penghitung yang
 * tidak tersentuh 24 jam dianggap basi dan di-reset, sehingga pengguna
 * sah tidak membawa hukuman lama selamanya.
 *
 * Seluruh fungsi FAIL-OPEN dengan console.error: kesalahan D1 (mis.
 * migrasi 0031 belum diterapkan pada deployment lama) tidak boleh
 * mengunci seluruh pengguna dari login; rate limit lama tetap berjalan
 * sebagai lapisan lain.
 */

export const ACCOUNT_FAILURE_THRESHOLD = 5;
export const IP_FAILURE_THRESHOLD = 50;
const LOCK_MINUTES: number[] = [5, 15, 60, 240, 1440];
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

interface LockoutRow {
  failures: number;
  lock_level: number;
  locked_until: string | null;
  updated_at: string;
}

export function accountLockoutKey(identifier: string): string {
  return `account:${identifier.trim().toLowerCase()}`;
}

export function ipLockoutKey(ip: string): string {
  return `ip:${ip}`;
}

function lockMinutesForLevel(level: number): number {
  const index = Math.min(Math.max(level, 1), LOCK_MINUTES.length) - 1;
  return LOCK_MINUTES[index];
}

/** Waktu berakhir kunci aktif terlama dari kunci-kunci ini, atau null. */
export async function getLoginLockoutUntil(db: D1Database, keys: string[]): Promise<Date | null> {
  try {
    let latest: Date | null = null;
    for (const key of keys) {
      const row = await db.prepare('SELECT locked_until FROM login_lockouts WHERE key = ?').bind(key).first<any>();
      if (!row?.locked_until) continue;
      const until = new Date(String(row.locked_until));
      if (!Number.isNaN(until.getTime()) && until.getTime() > Date.now() && (latest === null || until > latest)) {
        latest = until;
      }
    }
    return latest;
  } catch (error) {
    console.error('Gagal memeriksa lockout login (fail-open):', error);
    return null;
  }
}

/** Catat satu kegagalan login untuk sebuah kunci; mengunci bila ambang tercapai. */
export async function recordLoginFailure(db: D1Database, key: string, threshold: number): Promise<void> {
  try {
    const now = new Date();
    const existing = await db.prepare(
      'SELECT failures, lock_level, locked_until, updated_at FROM login_lockouts WHERE key = ?'
    ).bind(key).first<LockoutRow>();
    let failures = Number(existing?.failures || 0);
    let lockLevel = Number(existing?.lock_level || 0);
    // Baris basi (>24 jam tanpa aktivitas) mulai dari nol lagi.
    if (existing && now.getTime() - new Date(String(existing.updated_at)).getTime() > STALE_AFTER_MS) {
      failures = 0;
      lockLevel = 0;
    }
    // Selama terkunci, kegagalan tambahan tidak memperpanjang kunci.
    if (existing?.locked_until && new Date(String(existing.locked_until)).getTime() > now.getTime()) return;
    failures += 1;
    let lockedUntil: string | null = null;
    if (failures >= threshold) {
      lockLevel += 1;
      lockedUntil = new Date(now.getTime() + lockMinutesForLevel(lockLevel) * 60 * 1000).toISOString();
      failures = 0;
    }
    await db.prepare(
      `INSERT INTO login_lockouts (key, failures, lock_level, locked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET failures = excluded.failures,
         lock_level = excluded.lock_level, locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`
    ).bind(key, failures, lockLevel, lockedUntil, now.toISOString()).run();
  } catch (error) {
    console.error('Gagal mencatat kegagalan login (fail-open):', error);
  }
}

/** Hapus baris lockout (login berhasil / reset password oleh admin). */
export async function clearLoginLockout(db: D1Database, key: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM login_lockouts WHERE key = ?').bind(key).run();
  } catch (error) {
    console.error('Gagal membersihkan lockout login (fail-open):', error);
  }
}
