import { type AuthUser } from '../../../_lib/auth';
import { jsonResponse } from '../../../_lib/response';
import { isTotpConfigured, TWO_FACTOR_ROLES, type TotpEnv } from '../../../_lib/totp';

interface Env extends TotpEnv { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

/** Status 2FA untuk pengguna yang sedang login (dipakai kartu keamanan Profil). */
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  const user = data.user;
  if (!user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  const applicable = (TWO_FACTOR_ROLES as readonly string[]).includes(user.role);
  const row = applicable
    ? await env.DB.prepare('SELECT totp_enabled FROM users WHERE id = ?').bind(user.id).first<any>()
    : null;
  const enabled = Number(row?.totp_enabled || 0) === 1;
  let recoveryCodesRemaining = 0;
  if (enabled) {
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS total FROM totp_recovery_codes WHERE user_id = ? AND used_at IS NULL'
    ).bind(user.id).first<any>();
    recoveryCodesRemaining = Number(count?.total || 0);
  }
  return jsonResponse({
    success: true,
    data: {
      applicable,
      configured: isTotpConfigured(env),
      enabled,
      recoveryCodesRemaining,
    },
  });
};
