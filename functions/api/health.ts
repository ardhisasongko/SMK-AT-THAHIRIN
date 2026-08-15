import { jsonResponse } from '../_lib/response';

interface Env { DB: D1Database; APP_NAME?: string }

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let db = 'ok';
  try {
    await env.DB.prepare('SELECT 1').first();
  } catch {
    db = 'error';
  }
  return jsonResponse({
      status: db === 'ok' ? 'ok' : 'degraded',
      school: "SMKS PLUS AT THAHIRIN",
      app: env.APP_NAME || "SMKS PLUS AT THAHIRIN",
      db,
      time: new Date().toISOString(),
  }, db === 'ok' ? 200 : 503);
};
