import 'dotenv/config';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const cfg={api:process.env.API_URL||'https://smk-at-tahirin.pages.dev',key:process.env.GATEWAY_KEY,activeStart:process.env.ACTIVE_START||'05:00',activeEnd:process.env.ACTIVE_END||'17:00',activeMs:Number(process.env.POLL_ACTIVE_MS)||60000,idleMs:Number(process.env.POLL_IDLE_MS)||600000,minDelay:Number(process.env.SEND_DELAY_MIN_MS)||5000,maxDelay:Number(process.env.SEND_DELAY_MAX_MS)||7000};
if(!cfg.key)throw new Error('GATEWAY_KEY wajib diisi.');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const inActiveHours=()=>{const d=new Date(Date.now()+7*3600*1000);const now=d.toISOString().slice(11,16);return now>=cfg.activeStart&&now<=cfg.activeEnd;};
const client=new Client({authStrategy:new LocalAuth({clientId:'smk-notification'}),puppeteer:{headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox','--disable-setuid-sandbox']}});
let ready=false,emptyRuns=0;
client.on('qr',qr=>{console.log('Scan QR berikut menggunakan WhatsApp nomor sekolah:');qrcode.generate(qr,{small:true});});
client.on('ready',()=>{ready=true;console.log('WhatsApp gateway siap.');});
client.on('disconnected',reason=>{ready=false;console.error('WhatsApp terputus:',reason);});

async function api(body){const r=await fetch(`${cfg.api}/api/whatsapp/gateway`,{method:'POST',headers:{'Content-Type':'application/json','X-Gateway-Key':cfg.key},body:JSON.stringify(body)});if(!r.ok)throw new Error(`Gateway API HTTP ${r.status}`);return r.json();}
async function cycle(){if(!ready)return;const claimed=await api({action:'claim'});const messages=claimed.data||[];if(!messages.length){emptyRuns++;return;}emptyRuns=0;const results=[];for(const m of messages){try{await client.sendMessage(`${m.recipient_phone}@c.us`,m.message_text);results.push({id:m.id,success:true});}catch(e){results.push({id:m.id,success:false,error:String(e?.message||e).slice(0,180)});}await sleep(cfg.minDelay+Math.floor(Math.random()*(cfg.maxDelay-cfg.minDelay+1)));}await api({action:'complete',claimToken:claimed.claimToken,results});console.log(`Batch selesai: ${results.filter(r=>r.success).length}/${results.length} terkirim.`);}
async function loop(){while(true){try{if(inActiveHours())await cycle();}catch(e){console.error(new Date().toISOString(),e.message);}const interval=inActiveHours()?(emptyRuns>=3?Math.min(cfg.idleMs,300000):cfg.activeMs):cfg.idleMs;await sleep(interval);}}
client.initialize();loop();
