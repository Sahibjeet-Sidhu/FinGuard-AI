const db = require('../database/db');
const { calculateRiskScore } = require('../services/riskScoringService');
const { generateTransactionExplanation } = require('../services/aiExplanationService');
const { logAction } = require('../services/auditService');

function buildTransactionQuery(filters) {
  let where = ['1=1'];
  const params = [];

  if (filters.search) {
    where.push(`(c.name LIKE ? OR t.merchant LIKE ? OR t.category LIKE ? OR t.location LIKE ? OR CAST(t.id AS TEXT) LIKE ?)`);
    const s = `%${filters.search}%`;
    params.push(s, s, s, s, s);
  }
  if (filters.riskLevel) {
    where.push('t.risk_level = ?');
    params.push(filters.riskLevel);
  }
  if (filters.flagged === 'true') {
    where.push('t.flagged = 1');
  }
  if (filters.category) {
    where.push('t.category = ?');
    params.push(filters.category);
  }
  if (filters.caseStatus) {
    where.push('fc.status = ?');
    params.push(filters.caseStatus);
  }
  if (filters.startDate) {
    where.push('t.transaction_time >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    where.push('t.transaction_time <= ?');
    params.push(filters.endDate);
  }

  const allowedSort = { amount: 't.amount', date: 't.transaction_time', risk_score: 't.risk_score' };
  const sortCol = allowedSort[filters.sortBy] || 't.transaction_time';
  const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';

  return { whereClause: where.join(' AND '), params, sortCol, sortDir };
}

function getTransactions(req, res) {
  const { whereClause, params, sortCol, sortDir } = buildTransactionQuery(req.query);

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN fraud_cases fc ON fc.transaction_id = t.id
    WHERE ${whereClause}
  `).get(...params);

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
  `).all(...params, limit, offset);

  const masked = rows.map(r => ({
    ...r,
    account_number: r.account_number ? maskAccount(r.account_number) : null,
  }));

  return res.json({
    data: masked,
    pagination: { page, limit, total: countRow.total, pages: Math.ceil(countRow.total / limit) },
  });
}

function getTransactionById(req, res) {
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
  `).get(id);

  if (!row) return res.status(404).json({ error: 'Transaction not found' });

  logAction({
    userId: req.user.id, userName: req.user.name,
    action: 'TRANSACTION_VIEWED', entityType: 'transaction', entityId: row.id,
  });

  return res.json({ ...row, account_number: maskAccount(row.account_number) });
}

function recalculateRisk(req, res) {
  const { id } = req.params;
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(transaction.customer_id);
  const oneHourAgo = new Date(new Date(transaction.transaction_time) - 60 * 60 * 1000).toISOString();
  const recentTxns = db.prepare(
    'SELECT id FROM transactions WHERE customer_id = ? AND transaction_time > ? AND transaction_time < ? AND id != ?'
  ).all(transaction.customer_id, oneHourAgo, transaction.transaction_time, transaction.id);

  const result = calculateRiskScore(transaction, customer, recentTxns);
  const explanation = generateTransactionExplanation(transaction, result.factors, customer);

  db.prepare(
    'UPDATE transactions SET risk_score = ?, risk_level = ?, flagged = ?, explanation = ? WHERE id = ?'
  ).run(result.score, result.riskLevel, result.flagged ? 1 : 0, explanation, id);

  return res.json({ score: result.score, riskLevel: result.riskLevel, factors: result.factors, explanation });
}

function maskAccount(num) {
  if (!num) return null;
  return '****' + num.slice(-4);
}

module.exports = { getTransactions, getTransactionById, recalculateRisk };
