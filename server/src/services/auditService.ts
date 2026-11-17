import db from '../database/db';

export interface AuditEntry {
  /** Who performed the action. Omitted for anonymous actions such as self-registration. */
  userId?: number | null;
  userName?: string | null;
  action: string;
  entityType?: string;
  entityId?: number | bigint | null;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

function logAction({ userId, userName, action, entityType, entityId, oldValue, newValue }: AuditEntry): void {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    userId ?? null,
    userName || null,
    action,
    entityType || null,
    entityId ?? null,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null
  );
}

export { logAction };
