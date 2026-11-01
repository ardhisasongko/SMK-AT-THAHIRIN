/**
 * Cloudflare Turnstile pada login (hardening Fase C) — SIAP-ENV:
 * fitur hanya aktif bila KEDUA nilai terisi:
 *   - TURNSTILE_SITE_KEY  (publik; variabel biasa, tampil di halaman login)
 *   - TURNSTILE_SECRET_KEY (secret server untuk verifikasi siteverify)
 * Keduanya kosong (keadaan bawaan semua deployment lama) = login berperilaku
 * persis seperti sebelumnya, tanpa widget dan tanpa verifikasi.
 * Verifikasi gagal / token kosong / layanan verifikasi tidak terjangkau
 * = DITOLAK (fail-closed) selama fitur aktif.
 */

export interface TurnstileEnv {
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export function isTurnstileEnabled(env: TurnstileEnv): boolean {
  return Boolean(env.TURNSTILE_SITE_KEY?.trim()) && Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

/** Site key publik untuk widget — hanya dibagikan bila fitur benar-benar aktif. */
export function turnstileSiteKey(env: TurnstileEnv): string | null {
  return isTurnstileEnabled(env) ? String(env.TURNSTILE_SITE_KEY).trim() : null;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Verifikasi token Turnstile ke Cloudflare siteverify. true hanya bila sukses eksplisit. */
export async function verifyTurnstileToken(
  env: TurnstileEnv,
  token: string,
  remoteIp?: string,
  fetcher: Fetcher = fetch,
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  try {
    const form = new URLSearchParams({
      secret: String(env.TURNSTILE_SECRET_KEY || ''),
      response: token,
    });
    if (remoteIp && remoteIp !== 'unknown') form.set('remoteip', remoteIp);
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!response.ok) return false;
    const json = await response.json() as { success?: unknown };
    return json?.success === true;
  } catch (error) {
    console.error('Verifikasi Turnstile gagal (fail-closed):', error);
    return false;
  }
}
