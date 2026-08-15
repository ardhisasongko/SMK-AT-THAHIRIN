import { jsonResponse } from '../../_lib/response';
import { enqueueMessage, normalizeIndonesianPhone, wibDateParts } from '../../_lib/whatsapp';

interface Env { DB:D1Database; WHATSAPP_GATEWAY_KEY?:string }
const MAX_ATTEMPTS=2;
const STALE_MINUTES=10;
const authorized=(env:Env,req:Request)=>!!env.WHATSAPP_GATEWAY_KEY&&req.headers.get('X-Gateway-Key')===env.WHATSAPP_GATEWAY_KEY;

export function isWithinActiveHours(time:string,start:string,end:string):boolean{
  return start<=end?time>=start&&time<=end:time>=start||time<=end;
}

export function deliveryOutcome(attemptCount:number,result:{success?:boolean;skipped?:boolean}):'sent'|'pending'|'failed'|'skipped'{
  if(result.success)return 'sent';
  if(result.skipped)return 'skipped';
  return attemptCount<MAX_ATTEMPTS?'pending':'failed';
}

export function heartbeatState(lastSeen:string|null,now=Date.now()):'never_seen'|'online'|'stale'{
  if(!lastSeen)return 'never_seen';
  return now-Date.parse(lastSeen)<=3*60_000?'online':'stale';
}

export function recipientAllowed(phone:string,mode:string,allowlist:string[]):boolean{
  if(mode==='all')return true;
  if(mode!=='canary')return false;
  return allowlist.includes(phone);
}

export function parseAllowlist(value:unknown):string[]|null{
  let values:unknown;
  try{values=typeof value==='string'?JSON.parse(value):value;}catch{return null;}
  if(!Array.isArray(values)||values.length>100)return null;
  const phones=values.map(phone=>normalizeIndonesianPhone(String(phone)));
  return phones.some(phone=>!phone)?null:[...new Set(phones as string[])];
}

export function staleClaimOutcome(attemptCount:number):'pending'|'failed'{
  return attemptCount<MAX_ATTEMPTS?'pending':'failed';
}

async function incrementStat(db:D1Database,column:'sent'|'failed'|'skipped',amount=1):Promise<void>{
  if(amount<1)return;
  await db.prepare(`INSERT INTO whatsapp_daily_stats (stat_date,${column}) VALUES (?,?) ON CONFLICT(stat_date) DO UPDATE SET ${column}=${column}+excluded.${column}`).bind(wibDateParts().date,amount).run();
}

function teacherMatches(lesson:any,teacher:any):boolean{
  const explicit=lesson.teacherUserId||lesson.teacherId||lesson.guruId;
  if(explicit)return String(explicit)===String(teacher.id);
  const normalize=(value:string)=>value.toLowerCase().replace(/\b(bpk|bapak|ibu|ir|s\.?pd)\b\.?/g,'').replace(/[^a-z0-9]/g,'');
  return normalize(String(lesson.guru||''))===normalize(String(teacher.name||''));
}

async function prepareTeacherReminders(db:D1Database):Promise<void>{
  const parts=wibDateParts();
  const kelasRow=await db.prepare("SELECT value FROM app_data WHERE key='kelas_v1'").first();
  let kelas:any[]=[];
  try{kelas=kelasRow?JSON.parse(String(kelasRow.value)):[];}catch{return;}
  const {results:teachers}=await db.prepare(`SELECT u.id,u.name,w.phone,w.reminder_time FROM users u JOIN teacher_whatsapp_settings w ON w.teacher_user_id=u.id WHERE u.role='guru' AND u.status='active' AND w.reminder_enabled=1 AND w.phone IS NOT NULL`).all();
  for(const teacher of teachers as any[]){
    const lessons:any[]=[];
    for(const group of kelas)for(const lesson of group.jadwal||[])if(lesson.hari===parts.dayLabel&&teacherMatches(lesson,teacher))lessons.push({...lesson,className:group.name});
    if(!lessons.length)continue;
    const marker=await db.prepare('INSERT OR IGNORE INTO whatsapp_teacher_reminders (teacher_user_id,reminder_date,created_at) VALUES (?,?,?)').bind(teacher.id,parts.date,new Date().toISOString()).run();
    if(Number(marker.meta?.changes||0)===0)continue;
    const lines=lessons.map((lesson,index)=>`${index+1}. ${lesson.jamRentan}\n   ${lesson.mataPelajaran}\n   Kelas: ${lesson.className}\n   Ruang: ${lesson.ruangan}`).join('\n\n');
    const text=`Selamat pagi Bapak/Ibu ${teacher.name}.\n\nJadwal mengajar Anda hari ini, ${parts.dayLabel}, ${parts.dateLabel}:\n\n${lines}\n\nMohon mempersiapkan pembelajaran dan presensi kelas.\n\nPesan otomatis sistem sekolah.`;
    const scheduledAt=new Date(`${parts.date}T${teacher.reminder_time||'05:30'}:00+07:00`).toISOString();
    const outboxId=`teacher:${parts.date}:${teacher.id}`;
    try{
      await enqueueMessage(db,{dedupeKey:outboxId,eventIdentity:outboxId,phone:String(teacher.phone),type:'teacher_reminder',text,teacherId:String(teacher.id),scheduledAt});
    }catch(error){
      await db.prepare('DELETE FROM whatsapp_teacher_reminders WHERE teacher_user_id=? AND reminder_date=?').bind(teacher.id,parts.date).run();
      throw error;
    }
  }
}

async function integration(db:D1Database):Promise<any>{
  return db.prepare("SELECT * FROM external_integrations WHERE integration_key='whatsapp_web'").first();
}

async function heartbeat(db:D1Database,body:any,now:string):Promise<Response>{
  const status=['starting','ready','disconnected','shutting_down','disabled'].includes(body.status)?body.status:'unknown';
  const health=JSON.stringify({ready:Boolean(body.ready),inFlight:Math.max(0,Number(body.inFlight)||0),uptimeSeconds:Math.max(0,Number(body.uptimeSeconds)||0),lastError:String(body.lastError||'').slice(0,200)});
  await db.prepare("UPDATE external_integrations SET last_heartbeat_at=?,gateway_status=?,gateway_version=?,health_json=?,updated_at=? WHERE integration_key='whatsapp_web'")
    .bind(now,status,String(body.version||'unknown').slice(0,40),health,now).run();
  return jsonResponse({success:true,serverTime:now});
}

export const onRequestPost:PagesFunction<Env>=async({env,request})=>{
  if(!authorized(env,request))return jsonResponse({success:false,error:'Gateway key tidak valid.'},401);
  let body:any;try{body=await request.json();}catch{return jsonResponse({success:false,error:'Body harus JSON.'},400);}
  const now=new Date().toISOString();
  if(body.action==='heartbeat')return heartbeat(env.DB,body,now);

  if(body.action==='claim'){
    const settings:any=await env.DB.prepare('SELECT * FROM whatsapp_settings WHERE id=1').first();
    const external:any=await integration(env.DB);
    const activeStart=String(settings?.active_start||'05:00');
    const activeEnd=String(settings?.active_end||'17:00');
    const activeHours=isWithinActiveHours(wibDateParts().time,activeStart,activeEnd);
    const enabled=Number(settings?.enabled)===1&&Number(external?.enabled)===1;
    const paused=Number(external?.emergency_pause)!==0;
    const mode=String(external?.rollout_mode||'off');

    const staleFinal=await env.DB.prepare(`UPDATE whatsapp_outbox SET status='failed',claimed_at=NULL,claim_token=NULL,last_error='Gateway tidak memulai pengiriman claim terakhir.' WHERE status='processing' AND datetime(claimed_at)<datetime('now','-${STALE_MINUTES} minutes') AND attempt_count>=?`).bind(MAX_ATTEMPTS).run();
    await incrementStat(env.DB,'failed',Number(staleFinal.meta?.changes||0));
    await env.DB.prepare(`UPDATE whatsapp_outbox SET status='pending',claim_token=NULL,claimed_at=NULL WHERE status='processing' AND datetime(claimed_at)<datetime('now','-${STALE_MINUTES} minutes') AND attempt_count<?`).bind(MAX_ATTEMPTS).run();
    if(!enabled||paused||mode==='off')return jsonResponse({success:true,data:[],enabled,paused,active:false,mode,activeStart,activeEnd});
    if(!activeHours)return jsonResponse({success:true,data:[],enabled:true,paused:false,active:false,mode,activeStart,activeEnd});

    await prepareTeacherReminders(env.DB);
    const allowlist=parseAllowlist(external.allowlist_json||'[]');
    if(mode==='canary'&&(!allowlist||!allowlist.length))return jsonResponse({success:true,data:[],enabled:true,paused:false,active:false,mode,configurationError:'Allowlist canary tidak valid.',activeStart,activeEnd});
    const limit=Math.min(Number(settings.max_batch)||25,25);
    const canaryFilter=mode==='canary'?` AND recipient_phone IN (${allowlist!.map(()=>'?').join(',')})`:'';
    const statement=env.DB.prepare(`SELECT id FROM whatsapp_outbox WHERE status='pending' AND scheduled_at<=? AND attempt_count<?${canaryFilter} ORDER BY scheduled_at LIMIT ?`);
    const {results:candidates}=mode==='canary'?await statement.bind(now,MAX_ATTEMPTS,...allowlist!,limit).all():await statement.bind(now,MAX_ATTEMPTS,limit).all();
    const ids=(candidates as any[]).map(row=>String(row.id));
    const claimToken=`claim-${crypto.randomUUID()}`;
    for(const id of ids)await env.DB.prepare("UPDATE whatsapp_outbox SET status='processing',claim_token=?,claimed_at=?,attempt_count=attempt_count+1 WHERE id=? AND status='pending'").bind(claimToken,now,id).run();
    if(!ids.length)return jsonResponse({success:true,data:[],claimToken,enabled:true,paused:false,active:true,mode,activeStart,activeEnd});
    const placeholders=ids.map(()=>'?').join(',');
    const messages=await env.DB.prepare(`SELECT id,recipient_phone,message_text FROM whatsapp_outbox WHERE id IN (${placeholders}) AND claim_token=?`).bind(...ids,claimToken).all();
    return jsonResponse({success:true,data:messages.results,claimToken,enabled:true,paused:false,active:true,mode,activeStart,activeEnd});
  }

  if(body.action==='begin_send'&&body.id&&body.claimToken){
    const changed=await env.DB.prepare(`UPDATE whatsapp_outbox SET status='sent_unknown'
      WHERE id=? AND claim_token=? AND status='processing'
      AND EXISTS (
        SELECT 1 FROM whatsapp_settings s JOIN external_integrations e ON e.integration_key='whatsapp_web'
        WHERE s.id=1 AND s.enabled=1 AND e.enabled=1 AND e.emergency_pause=0
          AND (e.rollout_mode='all' OR (e.rollout_mode='canary' AND EXISTS (
            SELECT 1 FROM json_each(CASE WHEN json_valid(e.allowlist_json) THEN e.allowlist_json ELSE '[]' END)
            WHERE CAST(value AS TEXT)=whatsapp_outbox.recipient_phone
          )))
      )`).bind(body.id,body.claimToken).run();
    if(Number(changed.meta?.changes||0)===0){
      await env.DB.prepare("UPDATE whatsapp_outbox SET status='pending',claim_token=NULL,claimed_at=NULL,attempt_count=MAX(0,attempt_count-1) WHERE claim_token=? AND status='processing'").bind(body.claimToken).run();
      return jsonResponse({success:false,blocked:true,error:'Pengiriman diblokir oleh konfigurasi terbaru.'},423);
    }
    await env.DB.prepare("INSERT INTO whatsapp_delivery_meta (outbox_id,delivery_state,send_started_at,updated_at) VALUES (?,'send_started',?,?) ON CONFLICT(outbox_id) DO UPDATE SET delivery_state='send_started',send_started_at=excluded.send_started_at,updated_at=excluded.updated_at").bind(body.id,now,now).run();
    return jsonResponse({success:true});
  }

  if(body.action==='complete'&&Array.isArray(body.results)){
    for(const result of body.results.slice(0,25)){
      const row:any=await env.DB.prepare("SELECT attempt_count,status FROM whatsapp_outbox WHERE id=? AND claim_token=? AND status IN ('processing','sent_unknown')").bind(result.id,body.claimToken).first();
      if(!row)continue;
      const status=deliveryOutcome(Number(row.attempt_count),result);
      const error=status==='sent'?null:String(result.error||(status==='skipped'?'Pengiriman dilewati.':'Gagal kirim')).slice(0,200);
      const changed=await env.DB.prepare("UPDATE whatsapp_outbox SET status=?,sent_at=?,last_error=?,claim_token=NULL,claimed_at=NULL WHERE id=? AND claim_token=? AND status IN ('processing','sent_unknown')").bind(status,status==='sent'?now:null,error,result.id,body.claimToken).run();
      if(Number(changed.meta?.changes||0)>0){
        await env.DB.prepare(`INSERT INTO whatsapp_delivery_meta (outbox_id,delivery_state,provider_message_id,provider_accepted_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(outbox_id) DO UPDATE SET delivery_state=excluded.delivery_state,provider_message_id=COALESCE(excluded.provider_message_id,provider_message_id),provider_accepted_at=excluded.provider_accepted_at,updated_at=excluded.updated_at`).bind(result.id,status,String(result.providerMessageId||'').slice(0,200)||null,status==='sent'?now:null,now).run();
        if(status!=='pending')await incrementStat(env.DB,status);
      }
    }
    return jsonResponse({success:true});
  }
  return jsonResponse({success:false,error:'Action tidak dikenal.'},400);
};
