import { deleteSession, type AuthEnv } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';

interface Env extends AuthEnv {}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const auth = request.headers.get('Authorization') || '';
  const cookieToken = request.headers.get('Cookie')
    ?.split(';').map(value => value.trim())
    .find(value => value.startsWith('smk_session='))?.slice('smk_session='.length);
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : cookieToken || null;
  if (token) {
    await deleteSession(env, token);
  }
  const response = jsonResponse({ success: true });
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  response.headers.set('Set-Cookie', `smk_session=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`);
  return response;
};
