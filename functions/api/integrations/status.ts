import type { AuthUser } from '../../_lib/auth';
import { isGeminiEnabled } from '../../_lib/gemini';
import { jsonResponse } from '../../_lib/response';

interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_ENABLED?: string;
  GEMINI_MODEL?: string;
}

type AuthData = Record<string, unknown> & { user: AuthUser | null };

async function optionalFirst<T>(db: D1Database, query: string, ...values: unknown[]): Promise<T | null> {
  try {
    return await db.prepare(query).bind(...values).first<T>();
  } catch {
    return null;
  }
}

async function optionalAll<T>(db: D1Database, query: string): Promise<T[]> {
  try {
    return (await db.prepare(query).all<T>()).results;
  } catch {
    return [];
  }
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch { return null; }
}

export async function getIntegrationStatus(env: Env) {
  const [whatsapp, outbox, sync] = await Promise.all([
    optionalFirst<any>(env.DB, "SELECT enabled, emergency_pause, rollout_mode, last_heartbeat_at, gateway_status, gateway_version, health_json FROM external_integrations WHERE integration_key='whatsapp_web'"),
    optionalAll<{ status: string; count: number }>(env.DB, 'SELECT status, COUNT(*) AS count FROM whatsapp_outbox GROUP BY status'),
    optionalFirst<{ value: string }>(env.DB, "SELECT value FROM app_data WHERE key='google_sync_status_v1'"),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    gemini: {
      enabled: isGeminiEnabled(env.GEMINI_ENABLED, env.GEMINI_API_KEY),
      configured: Boolean(env.GEMINI_API_KEY?.trim()),
      model: env.GEMINI_MODEL || null,
    },
    whatsapp: whatsapp ? {
      enabled: Number(whatsapp.enabled) === 1,
      emergencyPause: Number(whatsapp.emergency_pause) !== 0,
      rolloutMode: whatsapp.rollout_mode,
      lastHeartbeatAt: whatsapp.last_heartbeat_at,
      gatewayStatus: whatsapp.gateway_status,
      gatewayVersion: whatsapp.gateway_version,
      health: parseJson(whatsapp.health_json),
      outbox: Object.fromEntries(outbox.map(row => [row.status, Number(row.count)])),
    } : { configured: false, outbox: {} },
    googleSync: parseJson(sync?.value),
  };
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user || !['admin', 'super_admin'].includes(data.user.role)) {
    return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  }
  return jsonResponse({ success: true, data: await getIntegrationStatus(env) });
};
