import { deleteSession, jsonResponse, type AuthEnv } from '../../_lib/auth';

interface Env extends AuthEnv {}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (token) {
    await deleteSession(env, token);
  }
  return jsonResponse({ success: true });
};