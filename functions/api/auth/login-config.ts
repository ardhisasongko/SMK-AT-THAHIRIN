import { jsonResponse } from '../../_lib/response';
import { turnstileSiteKey, type TurnstileEnv } from '../../_lib/turnstile';

interface Env extends TurnstileEnv { DB: D1Database }

/**
 * Konfigurasi publik halaman login (hardening Fase C). Site key Turnstile
 * hanya dibagikan bila fitur benar-benar aktif (site key DAN secret
 * terpasang); selain itu null dan halaman login tampil tanpa widget —
 * perilaku login persis seperti sebelumnya.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return jsonResponse({ success: true, data: { turnstileSiteKey: turnstileSiteKey(env) } });
};
