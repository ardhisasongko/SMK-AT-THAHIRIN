import type { AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { maskPhone, wibDateParts } from '../../_lib/whatsapp';
interface Env { DB:D1Database }
type AuthData=Record<string,unknown>&{user:AuthUser|null};
export const onRequestGet:PagesFunction<Env,any,AuthData>=async({env,data,request})=>{
  if(!data.user||!['super_admin','admin'].includes(data.user.role))return jsonResponse({success:false,error:'Akses ditolak.'},403);
  const url=new URL(request.url);
  const limit=Math.min(100,Math.max(10,Number(url.searchParams.get('limit'))||50));
  const cursor=url.searchParams.get('cursor');
  const query=`SELECT o.id,o.recipient_phone,o.message_type,o.status,o.attempt_count,o.scheduled_at,o.sent_at,o.last_error,o.created_at,m.delivery_state,m.provider_message_id
    FROM whatsapp_outbox o LEFT JOIN whatsapp_delivery_meta m ON m.outbox_id=o.id
    ${cursor?'WHERE (o.created_at < ? OR (o.created_at = ? AND o.id < ?))':''}
    ORDER BY o.created_at DESC,o.id DESC LIMIT ?`;
  const statement=cursor?env.DB.prepare(query).bind(cursor,cursor,url.searchParams.get('cursorId')||'',limit+1):env.DB.prepare(query).bind(limit+1);
  const{results}=await statement.all();
  const hasMore=results.length>limit;
  const rows=(hasMore?results.slice(0,limit):results) as any[];
  const last=rows.at(-1);
  return jsonResponse({success:true,data:rows.map(r=>({...r,recipient_phone:maskPhone(r.recipient_phone)})),page:{hasMore,nextCursor:hasMore?last.created_at:null,nextCursorId:hasMore?last.id:null}});
};

export const onRequestPost:PagesFunction<Env,any,AuthData>=async({env,data,request})=>{
  if(!data.user||!['super_admin','admin'].includes(data.user.role))return jsonResponse({success:false,error:'Akses ditolak.'},403);
  let body:any;try{body=await request.json();}catch{return jsonResponse({success:false,error:'Body harus JSON.'},400);}
  if(body.action==='cleanup'){
    const setting:any=await env.DB.prepare('SELECT retention_days FROM whatsapp_settings WHERE id=1').first();
    const days=Math.min(90,Math.max(7,Number(setting?.retention_days)||30));
    const result=await env.DB.prepare("DELETE FROM whatsapp_outbox WHERE status IN ('sent','failed','skipped') AND created_at < datetime('now','-' || ? || ' days')").bind(days).run();
    return jsonResponse({success:true,deleted:Number(result.meta?.changes||0),retentionDays:days});
  }
  if(body.action==='reconcile'){
    if(data.user.role!=='super_admin')return jsonResponse({success:false,error:'Rekonsiliasi khusus Super Admin.'},403);
    if(!body.id||!['sent','failed'].includes(body.resolution)||typeof body.note!=='string'||body.note.trim().length<5)return jsonResponse({success:false,error:'ID, resolusi, dan catatan verifikasi wajib diisi.'},400);
    const now=new Date().toISOString();
    const status=body.resolution as 'sent'|'failed';
    const note=`Rekonsiliasi manual: ${body.note.trim().slice(0,180)}`;
    const eventId=`reconcile-${crypto.randomUUID()}`;
    const update=env.DB.prepare("UPDATE whatsapp_outbox SET status=?,sent_at=?,last_error=?,claim_token=NULL,claimed_at=NULL WHERE id=? AND status='sent_unknown'").bind(status,status==='sent'?now:null,status==='sent'?null:note,body.id);
    const audit=env.DB.prepare('INSERT INTO whatsapp_reconciliation_events (id,outbox_id,resolution,note,resolved_by,resolved_at) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(eventId,body.id,status,note,data.user.id,now);
    const stat=env.DB.prepare(`INSERT INTO whatsapp_daily_stats (stat_date,${status}) SELECT ?,1 WHERE EXISTS (SELECT 1 FROM whatsapp_reconciliation_events WHERE id=?) ON CONFLICT(stat_date) DO UPDATE SET ${status}=${status}+1`).bind(wibDateParts().date,eventId);
    const results=await env.DB.batch([update,audit,stat]);
    if(Number(results[0].meta?.changes||0)===0)return jsonResponse({success:false,error:'Pesan bukan sent_unknown atau sudah direkonsiliasi.'},409);
    return jsonResponse({success:true,status});
  }
  return jsonResponse({success:false,error:'Action tidak dikenal.'},400);
};
