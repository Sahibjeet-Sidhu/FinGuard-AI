const db = require('../database/db');

function getAuditLogs(req, res) {
  const { page = 1, limit = 50, action, entityType } = req.query;
  let where = ['1=1'];
  const params = [];

  if (action) { where.push('action = ?'); params.push(action); }
  if (entityType) { where.push('entity_type = ?'); params.push(entityType); }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM audit_logs WHERE ${where.join(' AND ')}`).get(...params);

  const rows = db.prepare(`
    SELECT * FROM audit_logs
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  return res.json({
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total: countRow.total, pages: Math.ceil(countRow.total / limitNum) },
  });
}

module.exports = { getAuditLogs };
