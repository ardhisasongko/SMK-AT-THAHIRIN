import type { AuthUser } from '../../../../_lib/auth';
import { isCbtStudent, parseProctorEvents } from '../../../../_lib/cbt';
import { jsonResponse } from '../../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

const TYPE_TO_FIELD: Record<string, 'tabSwitch' | 'windowBlur' | 'fullscreenExit'> = {
  tab_switch: 'tabSwitch',
  window_blur: 'windowBlur',
  fullscreen_exit: 'fullscreenExit',
};

// Catatan peristiwa proctoring web dari runner siswa. Sifatnya PENCATATAN saja:
// tidak ada auto-submit/auto-gagal. Disimpan sebagai agregat counter ringkas
// di proctor_events_json agar hemat dan mudah ditampilkan ke guru.
export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request, params }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStudent(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (!Array.isArray(body?.events) || body.events.length === 0 || body.events.length > 50) return jsonResponse({ success: false, error: 'Peristiwa proctoring tidak valid.' }, 400);

  const attempt = await env.DB.prepare('SELECT * FROM cbt_attempts WHERE id=? AND student_user_id=?').bind(String(params.id), data.user.id).first<any>();
  if (!attempt) return jsonResponse({ success: false, error: 'Percobaan ujian tidak ditemukan.' }, 404);
  if (attempt.status !== 'in_progress') return jsonResponse({ success: false, error: 'Ujian sudah tidak berjalan.' }, 409);

  const counters = parseProctorEvents(attempt.proctor_events_json);
  let accepted = 0;
  for (const event of body.events) {
    const field = typeof event?.type === 'string' ? TYPE_TO_FIELD[event.type] : undefined;
    if (!field) return jsonResponse({ success: false, error: 'Jenis peristiwa proctoring tidak dikenal.' }, 400);
    counters[field] += 1;
    accepted += 1;
  }
  const payload = { ...counters, updatedAt: new Date().toISOString() };
  await env.DB.prepare('UPDATE cbt_attempts SET proctor_events_json=? WHERE id=?').bind(JSON.stringify(payload), attempt.id).run();
  return jsonResponse({ success: true, data: { attemptId: String(attempt.id), accepted, ...counters } });
};
