import { jsonResponse } from '../../_lib/response';
import { enqueueMessage, wibDateParts } from '../../_lib/whatsapp';
interface Env { DB:D1Database; WHATSAPP_GATEWAY_KEY?:string }
const authorized=(env:Env,req:Request)=>!!env.WHATSAPP_GATEWAY_KEY&&req.headers.get('X-Gateway-Key')===env.WHATSAPP_GATEWAY_KEY;

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
    if(!settings||Number(settings.enabled)!==1)return jsonResponse({success:true,data:[],enabled:false});
    await prepareTeacherReminders(env.DB);
    const limit=Math.min(Number(settings.max_batch)||25,25);const claim=`claim-${crypto.randomUUID()}`;
    await env.DB.prepare(`UPDATE whatsapp_outbox SET status='pending', claim_token=NULL, claimed_at=NULL WHERE status='processing' AND claimed_at < datetime('now','-10 minutes') AND attempt_count < 2`).run();
    const {results}=await env.DB.prepare(`SELECT id FROM whatsapp_outbox WHERE status='pending' AND scheduled_at<=? AND attempt_count<2 ORDER BY scheduled_at LIMIT ?`).bind(now,limit).all();
    if(!results.length)return jsonResponse({success:true,data:[],claimToken:claim});
    const ids=results.map((r:any)=>String(r.id));
    for(const id of ids)await env.DB.prepare(`UPDATE whatsapp_outbox SET status='processing', claim_token=?, claimed_at=?, attempt_count=attempt_count+1 WHERE id=? AND status='pending'`).bind(claim,now,id).run();
    const placeholders=ids.map(()=>'?').join(',');const messages=await env.DB.prepare(`SELECT id,recipient_phone,message_text FROM whatsapp_outbox WHERE id IN (${placeholders}) AND claim_token=?`).bind(...ids,claim).all();
    return jsonResponse({success:true,data:messages.results,claimToken:claim});
  }
  if(b.action==='complete'&&Array.isArray(b.results)){
    for(const r of b.results.slice(0,25)){const status=r.success?'sent':'failed';await env.DB.prepare(`UPDATE whatsapp_outbox SET status=?, sent_at=?, last_error=?, claim_token=NULL WHERE id=? AND claim_token=?`).bind(status,r.success?now:null,r.success?null:String(r.error||'Gagal kirim').slice(0,200),r.id,b.claimToken).run();}
    return jsonResponse({success:true});
  }
  return jsonResponse({success:false,error:'Action tidak dikenal.'},400);
};
