import { deleteSession, type AuthEnv } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';

interface Env extends AuthEnv {}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (token) {
    await deleteSession(env, token);
  }
  return jsonResponse({ success: true });
};