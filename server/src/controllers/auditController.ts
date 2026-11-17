import type { Request, Response } from 'express';
import db from '../database/db';
import { pagination, queryString } from '../utils/request';
import type { AuditLogRow, SqlParam } from '../types';

function getAuditLogs(req: Request, res: Response) {
  const action = queryString(req.query.action);
  const entityType = queryString(req.query.entityType);
  const where = ['1=1'];
  const params: SqlParam[] = [];

  if (action) { where.push('action = ?'); params.push(action); }
  if (entityType) { where.push('entity_type = ?'); params.push(entityType); }

  const { page, limit, offset } = pagination(req.query, 50, 200);

  const { total } = db.prepare(
    `SELECT COUNT(*) as total FROM audit_logs WHERE ${where.join(' AND ')}`
  ).get(...params) as { total: number };

  const rows = db.prepare(`
    SELECT * FROM audit_logs
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as AuditLogRow[];

  return res.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export { getAuditLogs };
