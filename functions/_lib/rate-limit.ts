export async function consumeRateLimit(db: D1Database, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + windowSeconds;
  const row = await db.prepare(`
    INSERT INTO api_rate_limits (key, window_started, request_count, window_expires)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      window_started = CASE WHEN api_rate_limits.window_expires <= ? THEN excluded.window_started ELSE api_rate_limits.window_started END,
      request_count = CASE WHEN api_rate_limits.window_expires <= ? THEN 1 ELSE api_rate_limits.request_count + 1 END,
      window_expires = CASE WHEN api_rate_limits.window_expires <= ? THEN excluded.window_expires ELSE api_rate_limits.window_expires END
    WHERE api_rate_limits.window_expires <= ? OR api_rate_limits.request_count < ?
    RETURNING request_count
  `).bind(key, now, expiresAt, now, now, now, now, limit).first<{ request_count: number }>();

  await db.prepare(`
    DELETE FROM api_rate_limits
    WHERE key IN (
      SELECT key FROM api_rate_limits
      WHERE window_expires <= ?
      ORDER BY window_expires
      LIMIT 32
    )
  `).bind(now).run();

  return row !== null;
}

export async function clearRateLimit(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM api_rate_limits WHERE key=?').bind(key).run();
}
