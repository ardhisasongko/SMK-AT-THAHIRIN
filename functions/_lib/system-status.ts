/**
 * Status sistem untuk monitoring (hardening Fase E).
 *
 * Dipakai bersama oleh `GET /api/health` (ringkas, publik, untuk uptime
 * monitor eksternal) dan panel status admin (`/api/integrations/status`).
 * Prinsip: TIDAK PERNAH membocorkan nilai rahasia atau identitas akun —
 * hanya status boolean, angka agregat, dan nama migrasi yang dikenal kode.
 * Setiap sub-pemeriksaan fail-soft (null) agar satu tabel yang belum
 * bermigrasi tidak menjatuhkan seluruh panel.
 */

import { getGeminiQuotaStatus, type GeminiQuotaStatus } from './gemini-quota';
import { countActiveLockouts, getLoginFailuresLast24h } from './login-lockout';
import { isTurnstileEnabled } from './turnstile';
import { isTotpConfigured } from './totp';
import { isGeminiEnabled } from './gemini';

/** Migrasi terakhir yang dikenal rilis kode ini (perbarui tiap migrasi baru). */
export const LATEST_KNOWN_MIGRATION = '0033_login_failure_stats';

export interface SystemStatusEnv {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_ENABLED?: string;
  GEMINI_MODEL?: string;
  GEMINI_DAILY_LIMIT?: string;
  TOTP_ENCRYPTION_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface SystemStatus {
  generatedAt: string;
  latestMigration: string;
  db: { ok: boolean; latencyMs: number | null };
  activeSessions: number | null;
  loginFailures24h: number | null;
  activeLockouts: number | null;
  aiQuotaToday: GeminiQuotaStatus;
  features: {
    geminiEnabled: boolean;
    geminiConfigured: boolean;
    twoFactorConfigured: boolean;
    turnstileEnabled: boolean;
  };
}

async function measureDb(db: D1Database): Promise<{ ok: boolean; latencyMs: number | null }> {
  const started = Date.now();
  try {
    await db.prepare('SELECT 1').first();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    console.error('Pemeriksaan kesehatan DB gagal:', error);
    return { ok: false, latencyMs: null };
  }
}

async function countActiveSessions(db: D1Database): Promise<number | null> {
  try {
    const row = await db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE expires_at > ?')
      .bind(new Date().toISOString()).first<{ total: number }>();
    return Number(row?.total || 0);
  } catch (error) {
    console.error('Gagal menghitung sesi aktif:', error);
    return null;
  }
}

export async function getSystemStatus(env: SystemStatusEnv): Promise<SystemStatus> {
  const [db, activeSessions, loginFailures24h, activeLockouts, aiQuotaToday] = await Promise.all([
    measureDb(env.DB),
    countActiveSessions(env.DB),
    getLoginFailuresLast24h(env.DB),
    countActiveLockouts(env.DB),
    getGeminiQuotaStatus(env.DB, env),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    latestMigration: LATEST_KNOWN_MIGRATION,
    db,
    activeSessions,
    loginFailures24h,
    activeLockouts,
    aiQuotaToday,
    features: {
      geminiEnabled: isGeminiEnabled(env.GEMINI_ENABLED, env.GEMINI_API_KEY),
      geminiConfigured: Boolean(env.GEMINI_API_KEY?.trim()),
      twoFactorConfigured: isTotpConfigured(env),
      turnstileEnabled: isTurnstileEnabled(env),
    },
  };
}
