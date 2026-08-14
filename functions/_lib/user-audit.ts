import type { AuthUser } from './auth';

export async function writeUserAudit(
  db: D1Database,
  actor: AuthUser,
  action: string,
  target: { id?: string; name?: string },
  beforeValue?: unknown,
  afterValue?: unknown,
  reason?: string
): Promise<void> {
  await db.prepare(
    `INSERT INTO user_audit_log
      (id, actor_id, actor_name, actor_role, action, target_user_id, target_name, before_value, after_value, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    `ual-${crypto.randomUUID()}`,
    actor.id,
    actor.name,
    actor.role,
    action,
    target.id || null,
    target.name || null,
    beforeValue === undefined ? null : JSON.stringify(beforeValue),
    afterValue === undefined ? null : JSON.stringify(afterValue),
    reason || null,
    new Date().toISOString()
  ).run();
}
