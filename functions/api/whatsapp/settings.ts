import type { AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { heartbeatState, parseAllowlist } from './gateway';
interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };
export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user || !['super_admin','admin'].includes(data.user.role)) return jsonResponse({ success:false,error:'Akses ditolak.'},403);
  const row:any = await env.DB.prepare('SELECT * FROM whatsapp_settings WHERE id=1').first();
  const integration:any = await env.DB.prepare("SELECT * FROM external_integrations WHERE integration_key='whatsapp_web'").first();
  const stats = await env.DB.prepare('SELECT * FROM whatsapp_daily_stats ORDER BY stat_date DESC LIMIT 14').all();
  let health=null;try{health=integration?.health_json?JSON.parse(String(integration.health_json)):null;}catch{health=null;}
  return jsonResponse({ success:true,data:{...row,integration_enabled:Number(integration?.enabled||0),emergency_pause:Number(integration?.emergency_pause??1),rollout_mode:integration?.rollout_mode||'off',allowlist_json:integration?.allowlist_json||'[]'},stats:stats.results,gateway:{status:heartbeatState(integration?.last_heartbeat_at||null),reportedStatus:integration?.gateway_status||'never_seen',lastSeen:integration?.last_heartbeat_at||null,version:integration?.gateway_version||null,health} });
};
export const onRequestPut: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user || data.user.role !== 'super_admin') return jsonResponse({ success:false,error:'Pengaturan gateway khusus Super Admin.'},403);
  let b:any; try { b=await request.json(); } catch { return jsonResponse({success:false,error:'Body harus JSON.'},400); }
  const batch=Math.min(50,Math.max(5,Number(b.maxBatch)||25));
  const mode=['off','canary','all'].includes(b.rolloutMode)?b.rolloutMode:'off';
  const allowlist=parseAllowlist(b.allowlist??[]);
  if(!allowlist)return jsonResponse({success:false,error:'Allowlist harus berupa JSON array berisi nomor WhatsApp valid.'},400);
  if(mode==='canary'&&!allowlist.length)return jsonResponse({success:false,error:'Mode canary memerlukan minimal satu nomor valid.'},400);
  const now=new Date().toISOString();
  await env.DB.prepare('UPDATE whatsapp_settings SET enabled=?, absence_cutoff=?, active_start=?, active_end=?, max_batch=?, retention_days=?, updated_by=?, updated_at=? WHERE id=1')
    .bind(b.enabled?1:0,b.absenceCutoff||'09:00',b.activeStart||'05:00',b.activeEnd||'17:00',batch,Math.min(90,Math.max(7,Number(b.retentionDays)||30)),data.user.id,now).run();
  await env.DB.prepare("UPDATE external_integrations SET enabled=?,emergency_pause=?,rollout_mode=?,allowlist_json=?,updated_by=?,updated_at=? WHERE integration_key='whatsapp_web'")
    .bind(b.integrationEnabled?1:0,b.emergencyPause===false?0:1,mode,JSON.stringify(allowlist),data.user.id,now).run();
  return jsonResponse({success:true});
};
