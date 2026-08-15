import { jsonResponse } from '../../_lib/response';
import { enqueueMessage, wibDateParts } from '../../_lib/whatsapp';
interface Env { DB:D1Database; WHATSAPP_GATEWAY_KEY?:string }
const authorized=(env:Env,req:Request)=>!!env.WHATSAPP_GATEWAY_KEY&&req.headers.get('X-Gateway-Key')===env.WHATSAPP_GATEWAY_KEY;
const MAX_ATTEMPTS=2;

export function isWithinActiveHours(time:string,start:string,end:string):boolean{
  return start<=end?time>=start&&time<=end:time>=start||time<=end;
}

export function deliveryOutcome(attemptCount:number,result:{success?:boolean;skipped?:boolean}):'sent'|'pending'|'failed'|'skipped'{
  if(result.success)return 'sent';
  if(result.skipped)return 'skipped';
  return attemptCount<MAX_ATTEMPTS?'pending':'failed';
}

async function incrementStat(db:D1Database,column:'sent'|'failed'|'skipped',amount=1):Promise<void>{
  if(amount<1)return;
  const date=wibDateParts().date;
  await db.prepare(`INSERT INTO whatsapp_daily_stats (stat_date,${column}) VALUES (?,?) ON CONFLICT(stat_date) DO UPDATE SET ${column}=${column}+excluded.${column}`).bind(date,amount).run();
}

const normalizeName=(v:string)=>v.toLowerCase().replace(/\b(bpk|bapak|ibu|ir|s\.?pd)\b\.?/g,'').replace(/[^a-z0-9]/g,'');
async function prepareTeacherReminders(db:D1Database):Promise<void>{
  const parts=wibDateParts();const jobKey=`teacher-reminders:${parts.date}`;
  const marker=await db.prepare('INSERT OR IGNORE INTO whatsapp_job_runs (job_key,created_at) VALUES (?,?)').bind(jobKey,new Date().toISOString()).run();
  if(Number(marker.meta?.changes||0)===0)return;
  const kelasRow=await db.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first();
  const kelas=kelasRow?JSON.parse(String(kelasRow.value)) as any[]:[];
  const {results:teachers}=await db.prepare(`SELECT u.id,u.name,w.phone,w.reminder_time FROM users u JOIN teacher_whatsapp_settings w ON w.teacher_user_id=u.id WHERE u.role='guru' AND u.status='active' AND w.reminder_enabled=1 AND w.phone IS NOT NULL`).all();
  for(const t of teachers as any[]){const lessons:any[]=[];for(const k of kelas)for(const j of k.jadwal||[])if(j.hari===parts.dayLabel&&normalizeName(j.guru).includes(normalizeName(String(t.name))))lessons.push({...j,className:k.name});if(!lessons.length)continue;
    const lines=lessons.map((l,i)=>`${i+1}. ${l.jamRentan}\n   ${l.mataPelajaran}\n   Kelas: ${l.className}\n   Ruang: ${l.ruangan}`).join('\n\n');
    const text=`Selamat pagi Bapak/Ibu ${t.name}.\n\nJadwal mengajar Anda hari ini, ${parts.dayLabel}, ${parts.dateLabel}:\n\n${lines}\n\nMohon mempersiapkan pembelajaran dan presensi kelas.\n\nPesan otomatis sistem sekolah.`;
    const scheduledAt=new Date(`${parts.date}T${t.reminder_time||'05:30'}:00+07:00`).toISOString();await enqueueMessage(db,{dedupeKey:`teacher:${parts.date}:${t.id}`,phone:String(t.phone),type:'teacher_reminder',text,teacherId:String(t.id),scheduledAt});}
}
export const onRequestPost:PagesFunction<Env>=async({env,request})=>{
  if(!authorized(env,request))return jsonResponse({success:false,error:'Gateway key tidak valid.'},401);
  let b:any;try{b=await request.json();}catch{return jsonResponse({success:false,error:'Body harus JSON.'},400);}
  const now=new Date().toISOString();
  if(b.action==='claim'){
    const settings:any=await env.DB.prepare('SELECT * FROM whatsapp_settings WHERE id=1').first();
    if(!settings)return jsonResponse({success:true,data:[],enabled:false,active:false});
    const activeStart=String(settings.active_start||'05:00');const activeEnd=String(settings.active_end||'17:00');
    const active=isWithinActiveHours(wibDateParts().time,activeStart,activeEnd);
    const retentionDays=Math.min(90,Math.max(7,Number(settings.retention_days)||30));
    await env.DB.prepare(`DELETE FROM whatsapp_outbox WHERE status IN ('sent','failed','skipped') AND created_at < datetime('now','-' || ? || ' days')`).bind(retentionDays).run();
    const staleFinal=await env.DB.prepare(`UPDATE whatsapp_outbox SET status='failed', claimed_at=NULL, claim_token=NULL, last_error='Gateway tidak menyelesaikan claim terakhir.' WHERE status='processing' AND datetime(claimed_at) < datetime('now','-10 minutes') AND attempt_count>=?`).bind(MAX_ATTEMPTS).run();
    await incrementStat(env.DB,'failed',Number(staleFinal.meta?.changes||0));
    await env.DB.prepare(`UPDATE whatsapp_outbox SET status='pending', claim_token=NULL, claimed_at=NULL WHERE status='processing' AND datetime(claimed_at) < datetime('now','-10 minutes') AND attempt_count<?`).bind(MAX_ATTEMPTS).run();
    if(Number(settings.enabled)!==1)return jsonResponse({success:true,data:[],enabled:false,active:false,activeStart,activeEnd});
    if(!active)return jsonResponse({success:true,data:[],enabled:true,active:false,activeStart,activeEnd});
    await prepareTeacherReminders(env.DB);
    const limit=Math.min(Number(settings.max_batch)||25,25);const claim=`claim-${crypto.randomUUID()}`;
    const {results}=await env.DB.prepare(`SELECT id FROM whatsapp_outbox WHERE status='pending' AND scheduled_at<=? AND attempt_count<? ORDER BY scheduled_at LIMIT ?`).bind(now,MAX_ATTEMPTS,limit).all();
    if(!results.length)return jsonResponse({success:true,data:[],claimToken:claim,enabled:true,active:true,activeStart,activeEnd});
    const ids=results.map((r:any)=>String(r.id));
    for(const id of ids)await env.DB.prepare(`UPDATE whatsapp_outbox SET status='processing', claim_token=?, claimed_at=?, attempt_count=attempt_count+1 WHERE id=? AND status='pending'`).bind(claim,now,id).run();
    const placeholders=ids.map(()=>'?').join(',');const messages=await env.DB.prepare(`SELECT id,recipient_phone,message_text FROM whatsapp_outbox WHERE id IN (${placeholders}) AND claim_token=?`).bind(...ids,claim).all();
    return jsonResponse({success:true,data:messages.results,claimToken:claim,enabled:true,active:true,activeStart,activeEnd});
  }
  if(b.action==='complete'&&Array.isArray(b.results)){
    for(const r of b.results.slice(0,25)){
      const row:any=await env.DB.prepare(`SELECT attempt_count FROM whatsapp_outbox WHERE id=? AND claim_token=? AND status='processing'`).bind(r.id,b.claimToken).first();
      if(!row)continue;
      const status=deliveryOutcome(Number(row.attempt_count),r);
      const error=status==='sent'?null:String(r.error||(status==='skipped'?'Pengiriman dilewati.':'Gagal kirim')).slice(0,200);
      const changed=await env.DB.prepare(`UPDATE whatsapp_outbox SET status=?, sent_at=?, last_error=?, claim_token=NULL, claimed_at=NULL WHERE id=? AND claim_token=? AND status='processing'`).bind(status,status==='sent'?now:null,error,r.id,b.claimToken).run();
      if(Number(changed.meta?.changes||0)>0&&status!=='pending')await incrementStat(env.DB,status);
    }
    return jsonResponse({success:true});
  }
  return jsonResponse({success:false,error:'Action tidak dikenal.'},400);
};
