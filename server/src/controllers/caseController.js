const db = require('../database/db');
const { generateCaseSummary } = require('../services/aiExplanationService');
const { logAction } = require('../services/auditService');

function getCases(req, res) {
  const { status, priority, assigned_to, search, page = 1, limit = 20 } = req.query;
  let where = ['1=1'];
  const params = [];

  if (status) { where.push('fc.status = ?'); params.push(status); }
  if (priority) { where.push('fc.priority = ?'); params.push(priority); }
  if (assigned_to) { where.push('fc.assigned_to = ?'); params.push(assigned_to); }
  if (search) {
    where.push('(c.name LIKE ? OR t.merchant LIKE ? OR CAST(fc.id AS TEXT) LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM fraud_cases fc
    LEFT JOIN transactions t ON fc.transaction_id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE ${where.join(' AND ')}
  `).get(...params);

  const rows = db.prepare(`
    SELECT fc.*, t.amount, t.merchant, t.category, t.location, t.risk_score, t.risk_level, t.transaction_time,
      c.name as customer_name, u.name as assigned_analyst_name
    FROM fraud_cases fc
    LEFT JOIN transactions t ON fc.transaction_id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN users u ON fc.assigned_to = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY fc.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  return res.json({
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total: countRow.total, pages: Math.ceil(countRow.total / limitNum) },
  });
}

function getCaseById(req, res) {
  const { id } = req.params;
  const caseRow = db.prepare(`
    SELECT fc.*, t.amount, t.merchant, t.category, t.location, t.risk_score, t.risk_level,
      t.transaction_time, t.explanation, t.transaction_type,
      c.name as customer_name, c.email as customer_email, c.usual_location,
      a.account_number,
      u.name as assigned_analyst_name, u.email as assigned_analyst_email
    FROM fraud_cases fc
    LEFT JOIN transactions t ON fc.transaction_id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN users u ON fc.assigned_to = u.id
    WHERE fc.id = ?
  `).get(id);

  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  const notes = db.prepare(`
    SELECT cn.*, u.name as author_name, u.role as author_role
    FROM case_notes cn
    LEFT JOIN users u ON cn.user_id = u.id
    WHERE cn.case_id = ?
    ORDER BY cn.created_at ASC
  `).all(id);

  return res.json({ ...caseRow, account_number: caseRow.account_number ? '****' + caseRow.account_number.slice(-4) : null, notes });
}

function createCase(req, res) {
  const { transaction_id, priority = 'Medium' } = req.body;
  if (!transaction_id) return res.status(400).json({ error: 'transaction_id is required' });

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transaction_id);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

  const existing = db.prepare('SELECT id FROM fraud_cases WHERE transaction_id = ?').get(transaction_id);
  if (existing) return res.status(409).json({ error: 'A case already exists for this transaction', caseId: existing.id });

  const allowedPriorities = ['Low', 'Medium', 'High', 'Critical'];
  const casePriority = allowedPriorities.includes(priority) ? priority : 'Medium';

  const result = db.prepare(
    'INSERT INTO fraud_cases (transaction_id, priority, status) VALUES (?, ?, ?)'
  ).run(transaction_id, casePriority, 'New');

  logAction({
    userId: req.user.id, userName: req.user.name,
    action: 'FRAUD_CASE_CREATED', entityType: 'fraud_case', entityId: result.lastInsertRowid,
    newValue: { transaction_id, priority: casePriority },
  });

  return res.status(201).json({ id: result.lastInsertRowid, message: 'Fraud case created' });
}

function updateCaseStatus(req, res) {
  const { id } = req.params;
  const { status, resolution } = req.body;
  const allowed = ['New', 'Under Review', 'Escalated', 'Resolved', 'False Positive'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const existing = db.prepare('SELECT * FROM fraud_cases WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Case not found' });

  db.prepare(
    'UPDATE fraud_cases SET status = ?, resolution = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, resolution || existing.resolution, id);

  logAction({
    userId: req.user.id, userName: req.user.name,
    action: 'CASE_STATUS_CHANGED', entityType: 'fraud_case', entityId: parseInt(id),
    oldValue: { status: existing.status }, newValue: { status, resolution },
  });

  return res.json({ message: 'Case status updated' });
}

function assignCase(req, res) {
  const { id } = req.params;
  const { analyst_id } = req.body;
  if (!analyst_id) return res.status(400).json({ error: 'analyst_id is required' });

  const analyst = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'analyst'").get(analyst_id);
  if (!analyst) return res.status(404).json({ error: 'Analyst not found' });

  const existing = db.prepare('SELECT * FROM fraud_cases WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Case not found' });

  db.prepare('UPDATE fraud_cases SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(analyst_id, id);

  logAction({
    userId: req.user.id, userName: req.user.name,
    action: 'CASE_ASSIGNED', entityType: 'fraud_case', entityId: parseInt(id),
    oldValue: { assigned_to: existing.assigned_to }, newValue: { assigned_to: analyst_id, analyst_name: analyst.name },
  });

  return res.json({ message: `Case assigned to ${analyst.name}` });
}

function addNote(req, res) {
  const { id } = req.params;
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: 'Note content is required' });

  const caseRow = db.prepare('SELECT id FROM fraud_cases WHERE id = ?').get(id);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  const result = db.prepare(
    'INSERT INTO case_notes (case_id, user_id, note) VALUES (?, ?, ?)'
  ).run(id, req.user.id, note.trim());

  db.prepare('UPDATE fraud_cases SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

  logAction({
    userId: req.user.id, userName: req.user.name,
    action: 'NOTE_ADDED', entityType: 'fraud_case', entityId: parseInt(id),
    newValue: { note_id: result.lastInsertRowid },
  });

  return res.status(201).json({ id: result.lastInsertRowid, message: 'Note added' });
}

function generateSummary(req, res) {
  const { id } = req.params;
  const caseRow = db.prepare(`
    SELECT fc.*, t.amount, t.merchant, t.location, t.risk_level, c.name as customer_name
    FROM fraud_cases fc
    LEFT JOIN transactions t ON fc.transaction_id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE fc.id = ?
  `).get(id);

  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  const notes = db.prepare('SELECT * FROM case_notes WHERE case_id = ?').all(id);
  const summary = generateCaseSummary(caseRow, caseRow, notes);

  db.prepare('UPDATE fraud_cases SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(summary, id);

  return res.json({ summary });
}

module.exports = { getCases, getCaseById, createCase, updateCaseStatus, assignCase, addNote, generateSummary };
