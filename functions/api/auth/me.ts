import { getUserFromRequest, type AuthEnv } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';

interface Env extends AuthEnv {}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const user = await getUserFromRequest(env, request);
  if (!user) {
    return jsonResponse({ success: false, error: 'Tidak terautentikasi.' }, 401);
  }
  return jsonResponse({ success: true, user });
};