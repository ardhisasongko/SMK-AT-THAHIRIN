import type { AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { maskPhone } from '../../_lib/whatsapp';
interface Env { DB:D1Database }
type AuthData=Record<string,unknown>&{user:AuthUser|null};
export const onRequestGet:PagesFunction<Env,any,AuthData>=async({env,data})=>{if(!data.user||!['super_admin','admin'].includes(data.user.role))return jsonResponse({success:false,error:'Akses ditolak.'},403);const setting:any=await env.DB.prepare('SELECT retention_days FROM whatsapp_settings WHERE id=1').first();const days=Math.min(90,Math.max(7,Number(setting?.retention_days)||30));await env.DB.prepare(`DELETE FROM whatsapp_outbox WHERE status IN ('sent','failed','skipped') AND created_at < datetime('now','-' || ? || ' days')`).bind(days).run();const{results}=await env.DB.prepare('SELECT id, recipient_phone, message_type, status, attempt_count, scheduled_at, sent_at, last_error FROM whatsapp_outbox ORDER BY created_at DESC LIMIT 300').all();return jsonResponse({success:true,data:results.map((r:any)=>({...r,recipient_phone:maskPhone(r.recipient_phone)}))});};
