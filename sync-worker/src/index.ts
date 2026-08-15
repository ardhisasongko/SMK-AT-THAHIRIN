import { runSync } from './sync';
import { Env, JobName } from './types';

const CRON_JOBS: Record<string, JobName> = {
  '0 13 * * *': 'daily',
  '0 14 * * 0': 'weekly',
};

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const job = CRON_JOBS[event.cron];
    if (!job) {
      console.error(`[sync] cron tidak dikenal: ${event.cron}`);
      return;
    }
    ctx.waitUntil(runSync(job, env).then(result => {
      console.log(`[sync] job=${job}`, JSON.stringify(result));
    }));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return json({ ok: false, error: 'Not found' }, 404);
    const authorization = request.headers.get('Authorization');
    if (!env.SYNC_TOKEN || authorization !== `Bearer ${env.SYNC_TOKEN}`) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }
    const job = new URL(request.url).searchParams.get('job');
    if (job !== 'daily' && job !== 'weekly') {
      return json({ ok: false, error: 'Use POST /?job=daily|weekly' }, 400);
    }
    const result = await runSync(job, env);
    const status = result.status === 'locked' ? 409 : result.status === 'disabled' ? 503 : result.ok ? 200 : 502;
    return json(result, status);
  },
};

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
