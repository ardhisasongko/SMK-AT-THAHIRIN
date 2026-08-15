import 'dotenv/config';
import http from 'node:http';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const {Client,LocalAuth}=pkg;

const cfg={
  enabled:process.env.GATEWAY_ENABLED==='true',
  api:process.env.API_URL||'https://smk-at-tahirin.pages.dev',key:process.env.GATEWAY_KEY,
  activeMs:Number(process.env.POLL_ACTIVE_MS)||60000,idleMs:Number(process.env.POLL_IDLE_MS)||600000,
  minDelay:Number(process.env.SEND_DELAY_MIN_MS)||5000,maxDelay:Number(process.env.SEND_DELAY_MAX_MS)||7000,
  timeoutMs:Number(process.env.REQUEST_TIMEOUT_MS)||15000,heartbeatMs:Number(process.env.HEARTBEAT_MS)||60000,
  healthHost:process.env.HEALTH_HOST||'127.0.0.1',healthPort:Number(process.env.HEALTH_PORT)||8788,
};
if(cfg.enabled&&!cfg.key)throw new Error('GATEWAY_KEY wajib diisi saat GATEWAY_ENABLED=true.');

const startedAt=Date.now();
const state={ready:false,active:false,stopping:false,inFlight:0,lastError:'',lastCycleAt:null,lastHeartbeatAt:null};
let emptyRuns=0;
let wakeSleep=()=>{};
const sleep=ms=>new Promise(resolve=>{const timer=setTimeout(resolve,ms);wakeSleep=()=>{clearTimeout(timer);resolve();};});

async function api(body,retries=0){
  let lastError;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const response=await fetch(`${cfg.api}/api/whatsapp/gateway`,{method:'POST',headers:{'Content-Type':'application/json','X-Gateway-Key':cfg.key},body:JSON.stringify(body),signal:AbortSignal.timeout(cfg.timeoutMs)});
      let result={};
      try{result=await response.json();}catch{}
      if(!response.ok){const error=new Error(result.error||`Gateway API HTTP ${response.status}`);error.status=response.status;error.body=result;throw error;}
      return result;
    }catch(error){lastError=error;if(error?.status>=400&&error?.status<500)throw error;if(attempt<retries)await sleep(Math.min(2000*(attempt+1),5000));}
  }
  throw lastError;
}

function health(){return {enabled:cfg.enabled,ready:state.ready,active:state.active,stopping:state.stopping,inFlight:state.inFlight,uptimeSeconds:Math.floor((Date.now()-startedAt)/1000),lastCycleAt:state.lastCycleAt,lastHeartbeatAt:state.lastHeartbeatAt,lastError:state.lastError};}
const server=http.createServer((request,response)=>{
  if(request.url!=='/health'){response.writeHead(404).end();return;}
  const healthy=!cfg.enabled||(!state.stopping&&Date.now()-startedAt<180000)||state.ready;
  response.writeHead(healthy?200:503,{'Content-Type':'application/json'}).end(JSON.stringify(health()));
});
server.listen(cfg.healthPort,cfg.healthHost,()=>console.log(`Health endpoint: http://${cfg.healthHost}:${cfg.healthPort}/health`));

let client=null;
let heartbeatTimer=null;
async function sendHeartbeat(status){
  if(!cfg.key)return;
  try{await api({action:'heartbeat',status,version:'1.1.0',...health()});state.lastHeartbeatAt=new Date().toISOString();}
  catch(error){state.lastError=String(error?.message||error).slice(0,200);}
}

async function cycle(){
  if(!state.ready||state.stopping)return;
  const claimed=await api({action:'claim'});
  state.active=claimed.active===true;
  const messages=claimed.data||[];
  if(!messages.length){emptyRuns++;state.lastCycleAt=new Date().toISOString();return;}
  emptyRuns=0;
  messageLoop:for(const message of messages){
    if(state.stopping)break;
    state.inFlight++;
    let providerAccepted=false;
    try{
      await api({action:'begin_send',id:message.id,claimToken:claimed.claimToken},2);
      const sent=await client.sendMessage(`${message.recipient_phone}@c.us`,message.message_text);
      providerAccepted=true;
      await api({action:'complete',claimToken:claimed.claimToken,results:[{id:message.id,success:true,providerMessageId:sent?.id?._serialized}]},3);
    }catch(error){
      const reason=String(error?.message||error).slice(0,180);
      state.lastError=reason;
      if(error?.status===423||error?.body?.blocked){
        state.active=false;
        console.error('Batch dihentikan karena pengiriman diblokir oleh server.');
        break messageLoop;
      }
      if(!providerAccepted){
        try{await api({action:'complete',claimToken:claimed.claimToken,results:[{id:message.id,success:false,error:reason}]},3);}catch(callbackError){state.lastError=`Complete gagal: ${String(callbackError?.message||callbackError).slice(0,160)}`;}
      }else{
        console.error(`Status ${message.id} tidak pasti; dibiarkan sent_unknown agar tidak terkirim ulang.`);
      }
    }finally{state.inFlight--;}
    if(!state.stopping)await sleep(cfg.minDelay+Math.floor(Math.random()*(Math.max(cfg.minDelay,cfg.maxDelay)-cfg.minDelay+1)));
  }
  state.lastCycleAt=new Date().toISOString();
}

async function loop(){
  while(!state.stopping){
    try{await cycle();}catch(error){state.lastError=String(error?.message||error).slice(0,200);console.error(new Date().toISOString(),state.lastError);}
    const interval=state.active?(emptyRuns>=3?Math.min(cfg.idleMs,300000):cfg.activeMs):cfg.idleMs;
    await sleep(interval);
  }
}

async function shutdown(signal){
  if(state.stopping)return;
  state.stopping=true;wakeSleep();console.log(`${signal}: menghentikan gateway...`);
  if(heartbeatTimer)clearInterval(heartbeatTimer);
  const drainDeadline=Date.now()+20000;
  while(state.inFlight>0&&Date.now()<drainDeadline)await sleep(200);
  await sendHeartbeat('shutting_down');
  try{if(client)await client.destroy();}catch(error){console.error('Gagal menutup WhatsApp client:',error);}
  await new Promise(resolve=>server.close(resolve));
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{shutdown(signal).finally(()=>process.exit(0));});

if(!cfg.enabled){console.log('Gateway OFF. Set GATEWAY_ENABLED=true hanya setelah konfigurasi server diaktifkan.');await sendHeartbeat('disabled');}
else{
  client=new Client({authStrategy:new LocalAuth({clientId:'smk-notification'}),puppeteer:{headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}});
  client.on('qr',qr=>{console.log('Scan QR berikut menggunakan WhatsApp nomor sekolah:');qrcode.generate(qr,{small:true});});
  client.on('ready',()=>{state.ready=true;state.lastError='';console.log('WhatsApp gateway siap.');sendHeartbeat('ready');});
  client.on('disconnected',reason=>{state.ready=false;state.lastError=String(reason).slice(0,200);console.error('WhatsApp terputus:',reason);sendHeartbeat('disconnected');});
  await sendHeartbeat('starting');
  heartbeatTimer=setInterval(()=>sendHeartbeat(state.ready?'ready':'starting'),cfg.heartbeatMs);
  heartbeatTimer.unref();
  client.initialize().catch(error=>{state.lastError=String(error?.message||error);console.error(state.lastError);});
  loop();
}
