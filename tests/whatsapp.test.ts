import { describe, expect, it, vi } from 'vitest';
import { attendanceMessage, enqueueMessage, maskPhone, messageEventGroup, messageFingerprint, normalizeIndonesianPhone } from '../functions/_lib/whatsapp';
import { deliveryOutcome, heartbeatState, isWithinActiveHours, parseAllowlist, recipientAllowed, staleClaimOutcome } from '../functions/api/whatsapp/gateway';
import { consentTransition, onRequestPut as saveContact } from '../functions/api/whatsapp/contacts';
import { onRequestPut as saveTeacher } from '../functions/api/whatsapp/teachers';
import { onRequestPost as gatewayRequest } from '../functions/api/whatsapp/gateway';
import { onRequestGet as getHistory, onRequestPost as updateHistory } from '../functions/api/whatsapp/history';

describe('WhatsApp notification helpers', () => {
  it('normalizes Indonesian mobile numbers', () => {
    expect(normalizeIndonesianPhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeIndonesianPhone('81234567890')).toBe('6281234567890');
    expect(normalizeIndonesianPhone('123')).toBeNull();
  });

  it('masks phone and builds attendance message', () => {
    expect(maskPhone('6281234567890')).toBe('62812****890');
    expect(attendanceMessage({ studentName: 'Budi', className: 'X MPLB 1', status: 'Terlambat', date: '2026-08-17', time: '08:10' })).toContain('TERLAMBAT');
  });

  it('counts queue only when dedupe insert succeeds', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const prepare = vi.fn((sql:string) => ({ bind: vi.fn(() => sql.startsWith('SELECT')?{first:vi.fn(async()=>({revision:1}))}:{run}) }));
    expect(await enqueueMessage({ prepare } as any, { dedupeKey: 'd1', phone: '6281234567890', type: 'test', text: 'Test', scheduledAt: '2026-08-17T00:00:00.000Z' })).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(4);
  });

  it('counts a duplicate outbox message as skipped', async () => {
    const revisionRun = vi.fn(async () => ({ meta: { changes: 0 } }));
    const insertRun = vi.fn(async () => ({ meta: { changes: 0 } }));
    const statRun = vi.fn(async () => ({ meta: { changes: 1 } }));
    const prepare = vi.fn()
      .mockReturnValueOnce({ bind: vi.fn(() => ({ run: revisionRun })) })
      .mockReturnValueOnce({ bind: vi.fn(() => ({ first: vi.fn(async()=>({revision:1})) })) })
      .mockReturnValueOnce({ bind: vi.fn(() => ({ run: insertRun })) })
      .mockReturnValueOnce({ bind: vi.fn(() => ({ run: statRun })) });
    expect(await enqueueMessage({ prepare } as any, { dedupeKey: 'duplicate', phone: '6281234567890', type: 'test', text: 'Test', scheduledAt: '2026-08-17T00:00:00.000Z' })).toBe(false);
    expect(String(prepare.mock.calls[3][0])).toContain('skipped');
  });

  it('groups attendance status transitions while retaining exact event fingerprints', () => {
    expect(messageEventGroup('attendance:2026-08-17:s1:Alpa:g1')).toBe('attendance:2026-08-17:s1:g1');
    expect(messageEventGroup('attendance:2026-08-17:s1:Hadir:g1')).toBe('attendance:2026-08-17:s1:g1');
    expect(messageFingerprint({text:'Alpa'})).toBe(messageFingerprint({text:'Alpa'}));
    expect(messageFingerprint({text:'Alpa'})).not.toBe(messageFingerprint({text:'Hadir'}));
  });

  it('retries a normal failure once and makes the second failure terminal', () => {
    expect(deliveryOutcome(1, { success: false })).toBe('pending');
    expect(deliveryOutcome(2, { success: false })).toBe('failed');
    expect(deliveryOutcome(1, { success: true })).toBe('sent');
    expect(deliveryOutcome(1, { skipped: true })).toBe('skipped');
  });

  it('supports D1 active hours including a window across midnight', () => {
    expect(isWithinActiveHours('08:00', '05:00', '17:00')).toBe(true);
    expect(isWithinActiveHours('18:00', '05:00', '17:00')).toBe(false);
    expect(isWithinActiveHours('23:30', '22:00', '04:00')).toBe(true);
    expect(isWithinActiveHours('03:30', '22:00', '04:00')).toBe(true);
  });

  it('keeps retries bounded and identifies stale heartbeats', () => {
    expect(staleClaimOutcome(1)).toBe('pending');
    expect(staleClaimOutcome(2)).toBe('failed');
    expect(heartbeatState(null)).toBe('never_seen');
    expect(heartbeatState('2026-08-17T00:00:00.000Z',Date.parse('2026-08-17T00:02:00.000Z'))).toBe('online');
    expect(heartbeatState('2026-08-17T00:00:00.000Z',Date.parse('2026-08-17T00:04:00.000Z'))).toBe('stale');
  });

  it('allows only explicitly canaried recipients before full rollout', () => {
    expect(recipientAllowed('6281234567890','off',[])).toBe(false);
    expect(recipientAllowed('6281234567890','canary',['6281234567890'])).toBe(true);
    expect(recipientAllowed('6280000000000','canary',['6281234567890'])).toBe(false);
    expect(recipientAllowed('6280000000000','all',[])).toBe(true);
  });

  it('rejects malformed or unsafe canary allowlists', () => {
    expect(parseAllowlist('["081234567890"]')).toEqual(['6281234567890']);
    expect(parseAllowlist('[invalid')).toBeNull();
    expect(parseAllowlist({phone:'081234567890'})).toBeNull();
    expect(parseAllowlist(['not-a-phone'])).toBeNull();
  });

  it('records consent grants and revocations only on transition', () => {
    expect(consentTransition(null,true)).toBe('granted');
    expect(consentTransition('2026-08-17T00:00:00Z',false)).toBe('revoked');
    expect(consentTransition('2026-08-17T00:00:00Z',true)).toBeNull();
    expect(consentTransition(null,false)).toBeNull();
  });

  it('batches contact update and consent audit atomically', async () => {
    const statements:string[]=[];
    const prepare=vi.fn((sql:string)=>{
      statements.push(sql);
      if(sql.includes("key = 'siswa_v1'"))return{first:vi.fn(async()=>({value:JSON.stringify([{id:'student-1'}])}))};
      if(sql.startsWith('SELECT consent_at'))return{bind:vi.fn(()=>({first:vi.fn(async()=>null)}))};
      return{bind:vi.fn(()=>({sql}))};
    });
    const batch=vi.fn(async(statements)=>statements.map(()=>({meta:{changes:1}})));
    const response=await saveContact({
      env:{DB:{prepare,batch}},data:{user:{id:'admin-1',role:'admin'}},
      request:new Request('https://example.test/api/whatsapp/contacts',{method:'PUT',body:JSON.stringify({studentId:'student-1',guardian1Phone:'081234567890',guardian1Enabled:true,consent:true,consentProvenance:'signed_form'})}),
    } as any);
    expect(response.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
    expect(statements.some(sql=>sql.includes('whatsapp_consent_events'))).toBe(true);
  });

  it('moves a claimed message to sent_unknown before provider send', async () => {
    const statements:string[]=[];
    const prepare=vi.fn((sql:string)=>{statements.push(sql);return{bind:vi.fn(()=>({run:vi.fn(async()=>({meta:{changes:1}}))}))};});
    const response=await gatewayRequest({
      env:{DB:{prepare},WHATSAPP_GATEWAY_KEY:'secret'},
      request:new Request('https://example.test/api/whatsapp/gateway',{method:'POST',headers:{'X-Gateway-Key':'secret'},body:JSON.stringify({action:'begin_send',id:'wa-1',claimToken:'claim-1'})}),
    } as any);
    expect(response.status).toBe(200);
    expect(statements[0]).toContain("status='sent_unknown'");
    expect(statements[1]).toContain('whatsapp_delivery_meta');
  });

  it('atomically blocks begin_send after emergency pause and releases the claim', async () => {
    const statements:string[]=[];
    const prepare=vi.fn((sql:string)=>{statements.push(sql);return{bind:vi.fn(()=>({run:vi.fn(async()=>({meta:{changes:sql.includes("SET status='sent_unknown'")?0:1}}))}))};});
    const response=await gatewayRequest({
      env:{DB:{prepare},WHATSAPP_GATEWAY_KEY:'secret'},
      request:new Request('https://example.test/api/whatsapp/gateway',{method:'POST',headers:{'X-Gateway-Key':'secret'},body:JSON.stringify({action:'begin_send',id:'wa-1',claimToken:'claim-1'})}),
    } as any);
    expect(response.status).toBe(423);
    expect(await response.json()).toMatchObject({blocked:true});
    expect(statements[0]).toContain('e.emergency_pause=0');
    expect(statements[0]).toContain("e.rollout_mode='canary'");
    expect(statements[1]).toContain("status='pending'");
  });

  it('filters canary recipients in SQL before applying the batch limit', async () => {
    let candidateSql='';
    const first=async(sql:string)=>sql.includes('whatsapp_settings')?{enabled:1,active_start:'00:00',active_end:'23:59',max_batch:25}:sql.includes('external_integrations')?{enabled:1,emergency_pause:0,rollout_mode:'canary',allowlist_json:'["6281234567890"]'}:null;
    const prepare=vi.fn((sql:string)=>({first:vi.fn(()=>first(sql)),all:vi.fn(async()=>({results:[]})),bind:vi.fn((...args:unknown[])=>({
      first:vi.fn(()=>first(sql)),
      run:vi.fn(async()=>({meta:{changes:0}})),
      all:vi.fn(async()=>{
        if(sql.includes("message_type")&&sql.includes('claim_token'))return{results:[{id:'eligible',recipient_phone:'6281234567890',message_text:'Test'}]};
        if(sql.includes("status='pending'")&&sql.includes('scheduled_at')){candidateSql=sql;expect(args).toContain('6281234567890');return{results:[{id:'eligible'}]};}
        return{results:[]};
      }),
    }))}));
    const response=await gatewayRequest({env:{DB:{prepare},WHATSAPP_GATEWAY_KEY:'secret'},request:new Request('https://example.test/api/whatsapp/gateway',{method:'POST',headers:{'X-Gateway-Key':'secret'},body:JSON.stringify({action:'claim'})})} as any);
    expect(response.status).toBe(200);
    expect(candidateSql).toMatch(/recipient_phone IN \(\?\).*ORDER BY.*LIMIT/s);
  });

  it('completes sent_unknown with provider identity and no retry', async () => {
    const calls:Array<{sql:string;args:unknown[]}>=[];
    const prepare=vi.fn((sql:string)=>({bind:vi.fn((...args:unknown[])=>{
      calls.push({sql,args});
      if(sql.startsWith('SELECT attempt_count'))return{first:vi.fn(async()=>({attempt_count:1,status:'sent_unknown'}))};
      return{run:vi.fn(async()=>({meta:{changes:1}}))};
    })}));
    const response=await gatewayRequest({
      env:{DB:{prepare},WHATSAPP_GATEWAY_KEY:'secret'},
      request:new Request('https://example.test/api/whatsapp/gateway',{method:'POST',headers:{'X-Gateway-Key':'secret'},body:JSON.stringify({action:'complete',claimToken:'claim-1',results:[{id:'wa-1',success:true,providerMessageId:'provider-1'}]})}),
    } as any);
    expect(response.status).toBe(200);
    expect(calls.some(call=>call.sql.includes('whatsapp_delivery_meta')&&call.args.includes('provider-1'))).toBe(true);
    expect(calls.find(call=>call.sql.startsWith('UPDATE whatsapp_outbox'))?.args[0]).toBe('sent');
  });

  it('paginates history without cleanup side effects', async () => {
    const statements:string[]=[];
    const prepare=vi.fn((sql:string)=>{statements.push(sql);return{bind:vi.fn(()=>({all:vi.fn(async()=>({results:[{id:'wa-1',recipient_phone:'6281234567890',created_at:'2026-08-17T00:00:00Z'}]}))}))};});
    const response=await getHistory({env:{DB:{prepare}},data:{user:{id:'admin-1',role:'admin'}},request:new Request('https://example.test/api/whatsapp/history?limit=20')} as any);
    expect(response.status).toBe(200);
    expect(statements.every(sql=>!sql.includes('DELETE'))).toBe(true);
    expect((await response.json()).page).toMatchObject({hasMore:false,nextCursor:null});
  });

  it('runs retention cleanup only through an explicit admin POST', async () => {
    const statements:string[]=[];
    const prepare=vi.fn((sql:string)=>{
      statements.push(sql);
      if(sql.startsWith('SELECT retention_days'))return{first:vi.fn(async()=>({retention_days:30}))};
      return{bind:vi.fn(()=>({run:vi.fn(async()=>({meta:{changes:4}}))}))};
    });
    const response=await updateHistory({env:{DB:{prepare}},data:{user:{id:'admin-1',role:'admin'}},request:new Request('https://example.test/api/whatsapp/history',{method:'POST',body:JSON.stringify({action:'cleanup'})})} as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({deleted:4,retentionDays:30});
    expect(statements.some(sql=>sql.startsWith('DELETE FROM whatsapp_outbox'))).toBe(true);
  });

  it('reconciles sent_unknown to a terminal state without scheduling retry', async () => {
    const statements:string[]=[];
    const prepare=vi.fn((sql:string)=>{statements.push(sql);return{bind:vi.fn(()=>({}))};});
    const batch=vi.fn(async()=>[{meta:{changes:1}},{meta:{changes:1}},{meta:{changes:1}}]);
    const response=await updateHistory({env:{DB:{prepare,batch}},data:{user:{id:'super-1',role:'super_admin'}},request:new Request('https://example.test/api/whatsapp/history',{method:'POST',body:JSON.stringify({action:'reconcile',id:'wa-1',resolution:'failed',note:'Diverifikasi tidak terkirim'})})} as any);
    expect(response.status).toBe(200);
    expect(statements[0]).toContain("status='sent_unknown'");
    expect(statements.every(sql=>!sql.includes("status='pending'"))).toBe(true);
    expect(statements.some(sql=>sql.includes('whatsapp_reconciliation_events'))).toBe(true);
  });

  it('rejects a guardian contact for a student outside the roster', async () => {
    const prepare = vi.fn(() => ({ first: vi.fn(async () => ({ value: JSON.stringify([{ id: 'student-1' }]) })) }));
    const response = await saveContact({
      env: { DB: { prepare } },
      data: { user: { id: 'admin-1', role: 'admin' } },
      request: new Request('https://example.test/api/whatsapp/contacts', { method: 'PUT', body: JSON.stringify({ studentId: 'missing' }) }),
    } as any);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ success: false, error: 'Siswa tidak ditemukan.' });
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('rejects WhatsApp settings for a missing teacher', async () => {
    const first = vi.fn(async () => null);
    const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ first })) }));
    const response = await saveTeacher({
      env: { DB: { prepare } },
      data: { user: { id: 'admin-1', role: 'admin' } },
      request: new Request('https://example.test/api/whatsapp/teachers', { method: 'PUT', body: JSON.stringify({ teacherId: 'missing', phone: '081234567890' }) }),
    } as any);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ success: false, error: 'Guru aktif tidak ditemukan.' });
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
