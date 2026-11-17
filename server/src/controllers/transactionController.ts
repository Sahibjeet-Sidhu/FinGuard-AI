import type { Request, Response } from 'express';
import db from '../database/db';
import { assessTransaction, parseFactors } from '../services/transactionRiskService';
import { logAction } from '../services/auditService';
import { currentUser, pagination, queryString } from '../utils/request';
import type { CasePriority, CaseStatus, SqlParam, TransactionRow } from '../types';

/** A transaction joined with its customer, account and (if any) fraud case. */
interface TransactionListRow extends TransactionRow {
  customer_name: string | null;
  usual_location: string | null;
  account_number: string | null;
  case_id: number | null;
  case_status: CaseStatus | null;
  case_priority: CasePriority | null;
  assigned_analyst: string | null;
}

interface TransactionDetailRow extends TransactionListRow {
  customer_email: string | null;
  average_transaction_amount: number | null;
  account_type: string | null;
  balance: number | null;
}

const SORT_COLUMNS: Record<string, string> = {
  amount: 't.amount',
  date: 't.transaction_time',
  risk_score: 't.risk_score',
};

function maskAccount(num: string | null): string | null {
  if (!num) return null;
  return '****' + num.slice(-4);
}

// Shapes a transaction row for the API: the account number is masked and the
// stored factor breakdown is returned as an array rather than a JSON string.
function serialize<T extends TransactionListRow>(row: T) {
  return {
    ...row,
    account_number: maskAccount(row.account_number),
    risk_factors: parseFactors(row.risk_factors),
  };
}

function buildTransactionQuery(query: Request['query']) {
  const where = ['1=1'];
  const params: SqlParam[] = [];

  const search = queryString(query.search);
  const riskLevel = queryString(query.riskLevel);
  const category = queryString(query.category);
  const caseStatus = queryString(query.caseStatus);
  const startDate = queryString(query.startDate);
  const endDate = queryString(query.endDate);

  if (search) {
    where.push(`(c.name LIKE ? OR t.merchant LIKE ? OR t.category LIKE ? OR t.location LIKE ? OR CAST(t.id AS TEXT) LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  if (riskLevel) {
    where.push('t.risk_level = ?');
    params.push(riskLevel);
  }
  if (query.flagged === 'true') {
    where.push('t.flagged = 1');
  }
  if (category) {
    where.push('t.category = ?');
    params.push(category);
  }
  if (caseStatus) {
    where.push('fc.status = ?');
    params.push(caseStatus);
  }
  if (startDate) {
    where.push('t.transaction_time >= ?');
    params.push(startDate);
  }
  if (endDate) {
    where.push('t.transaction_time <= ?');
    params.push(endDate);
  }

  // Only whitelisted column names are ever interpolated into the SQL.
  const sortCol = SORT_COLUMNS[queryString(query.sortBy) ?? ''] ?? 't.transaction_time';
  const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';

  return { whereClause: where.join(' AND '), params, sortCol, sortDir };
}

function getTransactions(req: Request, res: Response) {
  const { whereClause, params, sortCol, sortDir } = buildTransactionQuery(req.query);
  const { page, limit, offset } = pagination(req.query, 20, 100);

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN fraud_cases fc ON fc.transaction_id = t.id
    WHERE ${whereClause}
  `).get(...params) as { total: number };

  const rows = db.prepare(`
    SELECT t.*, c.name as customer_name, c.usual_location,
      a.account_number,
      fc.id as case_id, fc.status as case_status, fc.priority as case_priority,
      u.name as assigned_analyst
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN fraud_cases fc ON fc.transaction_id = t.id
    LEFT JOIN users u ON fc.assigned_to = u.id
    WHERE ${whereClause}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as TransactionListRow[];

  return res.json({
    data: rows.map(serialize),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

function getTransactionById(req: Request, res: Response) {
  const { id } = req.params;
  const row = db.prepare(`
    SELECT t.*, c.name as customer_name, c.email as customer_email,
      c.usual_location, c.average_transaction_amount,
      a.account_number, a.account_type, a.balance,
      fc.id as case_id, fc.status as case_status, fc.priority as case_priority,
      u.name as assigned_analyst
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN fraud_cases fc ON fc.transaction_id = t.id
    LEFT JOIN users u ON fc.assigned_to = u.id
    WHERE t.id = ?
  `).get(id) as TransactionDetailRow | undefined;

  if (!row) return res.status(404).json({ error: 'Transaction not found' });

  const user = currentUser(req);
  logAction({
    userId: user.id, userName: user.name,
    action: 'TRANSACTION_VIEWED', entityType: 'transaction', entityId: row.id,
  });

  return res.json(serialize(row));
}

function recalculateRisk(req: Request, res: Response) {
  const { id } = req.params;
  const result = assessTransaction(id);
  if (!result) return res.status(404).json({ error: 'Transaction not found' });

  const user = currentUser(req);
  logAction({
    userId: user.id, userName: user.name,
    action: 'RISK_RECALCULATED', entityType: 'transaction', entityId: parseInt(id, 10),
    oldValue: { risk_score: result.previous.score, risk_level: result.previous.riskLevel },
    newValue: { risk_score: result.score, risk_level: result.riskLevel },
  });

  return res.json({
    score: result.score,
    rawScore: result.rawScore,
    riskLevel: result.riskLevel,
    flagged: result.flagged,
    factors: result.factors,
    explanation: result.explanation,
  });
}

export { getTransactions, getTransactionById, recalculateRisk };
