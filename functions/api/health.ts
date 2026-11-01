import { jsonResponse } from '../_lib/response';
import { getSystemStatus, type SystemStatusEnv } from '../_lib/system-status';

interface Env extends SystemStatusEnv { APP_NAME?: string }

/**
 * Health check untuk uptime monitor eksternal (UptimeRobot/Better Stack)
 * dan pemeriksaan cepat operator. Publik secara sengaja, tetapi hanya
 * memuat status agregat: kesehatan + latensi DB, versi migrasi terakhir
 * yang dikenal kode, dan status fitur boolean — tanpa rahasia, tanpa
 * identitas akun, tanpa data pengguna.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const system = await getSystemStatus(env);
  const healthy = system.db.ok;
  return jsonResponse({
    status: healthy ? 'ok' : 'degraded',
    school: "SMK PLUS AT-THAHIRIN",
    app: env.APP_NAME || "SMK PLUS AT-THAHIRIN",
    db: healthy ? 'ok' : 'error',
    dbLatencyMs: system.db.latencyMs,
    migration: { latestKnown: system.latestMigration },
    components: {
      gemini: {
        enabled: system.features.geminiEnabled,
        configured: system.features.geminiConfigured,
      },
      twoFactor: { configured: system.features.twoFactorConfigured },
      turnstile: { enabled: system.features.turnstileEnabled },
    },
    aiQuotaToday: {
      used: system.aiQuotaToday.used,
      limit: system.aiQuotaToday.limit,
    },
    time: new Date().toISOString(),
  }, healthy ? 200 : 503);
};
