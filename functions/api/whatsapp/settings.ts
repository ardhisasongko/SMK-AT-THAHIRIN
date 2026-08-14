import type { AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user || !['super_admin','admin'].includes(data.user.role)) return jsonResponse({ success:false,error:'Akses ditolak.'},403);
  const row = await env.DB.prepare('SELECT * FROM whatsapp_settings WHERE id=1').first();
  const stats = await env.DB.prepare('SELECT * FROM whatsapp_daily_stats ORDER BY stat_date DESC LIMIT 14').all();
  return jsonResponse({ success:true,data:row,stats:stats.results });
};
export const onRequestPut: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user || data.user.role !== 'super_admin') return jsonResponse({ success:false,error:'Pengaturan gateway khusus Super Admin.'},403);
  let b:any; try { b=await request.json(); } catch { return jsonResponse({success:false,error:'Body harus JSON.'},400); }
  const batch=Math.min(50,Math.max(5,Number(b.maxBatch)||25));
  await env.DB.prepare('UPDATE whatsapp_settings SET enabled=?, absence_cutoff=?, active_start=?, active_end=?, max_batch=?, retention_days=?, updated_by=?, updated_at=? WHERE id=1')
    .bind(b.enabled?1:0,b.absenceCutoff||'09:00',b.activeStart||'05:00',b.activeEnd||'17:00',batch,Math.min(90,Math.max(7,Number(b.retentionDays)||30)),data.user.id,new Date().toISOString()).run();
  return jsonResponse({success:true});
};
