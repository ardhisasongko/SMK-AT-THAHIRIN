export async function consumeRateLimit(db: D1Database, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('SELECT window_started,request_count FROM api_rate_limits WHERE key=?').bind(key).first<any>();
  if (!row || now - Number(row.window_started) >= windowSeconds) {
    await db.prepare('INSERT INTO api_rate_limits (key,window_started,request_count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET window_started=excluded.window_started,request_count=1').bind(key, now).run();
    return true;
  }
  if (Number(row.request_count) >= limit) return false;
  await db.prepare('UPDATE api_rate_limits SET request_count=request_count+1 WHERE key=?').bind(key).run();
  return true;
}

export async function clearRateLimit(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM api_rate_limits WHERE key=?').bind(key).run();
}
