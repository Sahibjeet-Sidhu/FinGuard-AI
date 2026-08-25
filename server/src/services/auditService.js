const db = require('../database/db');

function logAction({ userId, userName, action, entityType, entityId, oldValue, newValue }) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    userId || null,
    userName || null,
    action,
    entityType || null,
    entityId || null,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null
  );
}

module.exports = { logAction };
