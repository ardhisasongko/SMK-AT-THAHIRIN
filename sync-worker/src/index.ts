import { Env } from './types';
import { dailySync, weeklySync } from './sync';

const CRON_JOBS: Record<string, 'daily' | 'weekly'> = {
  '0 13 * * *': 'daily', // setiap hari 20:00 WIB
  '0 14 * * 0': 'weekly', // Minggu 21:00 WIB
};

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const job = CRON_JOBS[event.cron] || 'daily';
    ctx.waitUntil(run(job, env));
  },

  // Manual trigger untuk pengujian: POST /?job=daily|weekly
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'POST') {
      const url = new URL(request.url);
      const job = url.searchParams.get('job');
      if (job === 'daily' || job === 'weekly') {
        ctx.waitUntil(run(job, env));
        return new Response(JSON.stringify({ ok: true, job, started: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response('Not found. POST /?job=daily|weekly', { status: 404 });
  },
};

async function run(job: 'daily' | 'weekly', env: Env): Promise<void> {
  console.log(`[sync] mulai job=${job}`);
  try {
    const res = job === 'daily' ? await dailySync(env) : await weeklySync(env);
    console.log(`[sync] selesai job=${job}`, JSON.stringify(res));
  } catch (e: any) {
    console.error(`[sync] GAGAL job=${job}`, e?.stack || String(e));
  }
}
