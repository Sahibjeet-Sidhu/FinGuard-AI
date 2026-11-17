import type { Request, Response } from 'express';
import db from '../database/db';
import { generateCaseSummary } from '../services/aiExplanationService';
import { logAction } from '../services/auditService';
import { parseFactors } from '../services/transactionRiskService';
import { currentUser, pagination, queryString, toId } from '../utils/request';
import type { CasePriority, CaseStatus, FraudCaseRow, RiskLevel, SqlParam } from '../types';

const STATUSES: readonly CaseStatus[] = ['New', 'Under Review', 'Escalated', 'Resolved', 'False Positive'];
const CLOSED_STATUSES: readonly CaseStatus[] = ['Resolved', 'False Positive'];
const PRIORITIES: readonly CasePriority[] = ['Low', 'Medium', 'High', 'Critical'];

const isStatus = (v: unknown): v is CaseStatus => STATUSES.includes(v as CaseStatus);
const isPriority = (v: unknown): v is CasePriority => PRIORITIES.includes(v as CasePriority);
const now = () => new Date().toISOString();

/** A fraud case joined with its transaction, customer and assigned analyst. */
interface CaseDetailRow extends FraudCaseRow {
  amount: number | null;
  merchant: string | null;
  category: string | null;
  location: string | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  transaction_time: string | null;
  explanation: string | null;
  risk_factors: string | null;
  transaction_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  usual_location: string | null;
  account_number: string | null;
  assigned_analyst_name: string | null;
  assigned_analyst_email: string | null;
}

interface CaseSummaryRow extends FraudCaseRow {
  amount: number | null;
  merchant: string | null;
  location: string | null;
  risk_level: RiskLevel | null;
  customer_name: string | null;
}

function getCases(req: Request, res: Response) {
  const status = queryString(req.query.status);
  const priority = queryString(req.query.priority);
  const assignedTo = queryString(req.query.assigned_to);
  const search = queryString(req.query.search);
  const where = ['1=1'];
  const params: SqlParam[] = [];

  if (status) { where.push('fc.status = ?'); params.push(status); }
  if (req.query.active === 'true') {
    where.push(`fc.status NOT IN (${CLOSED_STATUSES.map(() => '?').join(', ')})`);
    params.push(...CLOSED_STATUSES);
  }
  if (priority) { where.push('fc.priority = ?'); params.push(priority); }
  if (assignedTo) { where.push('fc.assigned_to = ?'); params.push(assignedTo); }
  if (search) {
    where.push('(c.name LIKE ? OR t.merchant LIKE ? OR CAST(fc.id AS TEXT) LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const { page, limit, offset } = pagination(req.query, 20, 100);

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM fraud_cases fc
    LEFT JOIN transactions t ON fc.transaction_id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE ${where.join(' AND ')}
  `).get(...params) as { total: number };

  const rows = db.prepare(`
    SELECT fc.*, t.amount, t.merchant, t.category, t.location, t.risk_score, t.risk_level, t.transaction_time,
      c.name as customer_name, u.name as assigned_analyst_name
    FROM fraud_cases fc
    LEFT JOIN transactions t ON fc.transaction_id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN users u ON fc.assigned_to = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY fc.created_at DESC, fc.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return res.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

function getCaseById(req: Request, res: Response) {
  const { id } = req.params;
  const caseRow = db.prepare(`
    SELECT fc.*, t.amount, t.merchant, t.category, t.location, t.risk_score, t.risk_level,
      t.transaction_time, t.explanation, t.risk_factors, t.transaction_type,
      c.name as customer_name, c.email as customer_email, c.usual_location,
      a.account_number,
      u.name as assigned_analyst_name, u.email as assigned_analyst_email
    FROM fraud_cases fc
    LEFT JOIN transactions t ON fc.transaction_id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN users u ON fc.assigned_to = u.id
    WHERE fc.id = ?
  `).get(id) as CaseDetailRow | undefined;

  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  const notes = db.prepare(`
    SELECT cn.*, u.name as author_name, u.role as author_role
    FROM case_notes cn
    LEFT JOIN users u ON cn.user_id = u.id
    WHERE cn.case_id = ?
    ORDER BY cn.created_at ASC
  `).all(id);

  return res.json({
    ...caseRow,
    account_number: caseRow.account_number ? '****' + caseRow.account_number.slice(-4) : null,
    risk_factors: parseFactors(caseRow.risk_factors),
    notes,
  });
}

function createCase(req: Request, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  const transaction_id = toId(body.transaction_id);
  if (!transaction_id) return res.status(400).json({ error: 'A valid transaction_id is required' });

  const transaction = db.prepare('SELECT id FROM transactions WHERE id = ?').get(transaction_id);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

  const existing = db.prepare('SELECT id FROM fraud_cases WHERE transaction_id = ?').get(transaction_id) as { id: number } | undefined;
  if (existing) return res.status(409).json({ error: 'A case already exists for this transaction', caseId: existing.id });

  const casePriority: CasePriority = isPriority(body.priority) ? body.priority : 'Medium';

  const result = db.prepare(
    'INSERT INTO fraud_cases (transaction_id, priority, status) VALUES (?, ?, ?)'
  ).run(transaction_id, casePriority, 'New');

  const user = currentUser(req);
  logAction({
    userId: user.id, userName: user.name,
    action: 'FRAUD_CASE_CREATED', entityType: 'fraud_case', entityId: result.lastInsertRowid,
    newValue: { transaction_id, priority: casePriority },
  });

  return res.status(201).json({ id: result.lastInsertRowid, message: 'Fraud case created' });
}

function updateCaseStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status, resolution } = (req.body || {}) as Record<string, unknown>;
  if (!isStatus(status)) return res.status(400).json({ error: 'Invalid status' });

  const existing = db.prepare('SELECT * FROM fraud_cases WHERE id = ?').get(id) as FraudCaseRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Case not found' });

  // A resolution only describes a closed case. Reopening a case clears it so
  // an open case never displays a stale outcome (the audit log keeps the old one).
  const submitted = typeof resolution === 'string' && resolution.trim() ? resolution.trim() : null;
  const newResolution = CLOSED_STATUSES.includes(status) ? (submitted || existing.resolution) : null;

  db.prepare(
    'UPDATE fraud_cases SET status = ?, resolution = ?, updated_at = ? WHERE id = ?'
  ).run(status, newResolution, now(), id);

  const user = currentUser(req);
  logAction({
    userId: user.id, userName: user.name,
    action: 'CASE_STATUS_CHANGED', entityType: 'fraud_case', entityId: existing.id,
    oldValue: { status: existing.status, resolution: existing.resolution },
    newValue: { status, resolution: newResolution },
  });

  return res.json({ message: 'Case status updated' });
}

function assignCase(req: Request, res: Response) {
  const { id } = req.params;
  const analyst_id = toId((req.body as Record<string, unknown> | undefined)?.analyst_id);
  if (!analyst_id) return res.status(400).json({ error: 'A valid analyst_id is required' });

  const analyst = db.prepare(
    "SELECT id, name FROM users WHERE id = ? AND role = 'analyst'"
  ).get(analyst_id) as { id: number; name: string } | undefined;
  if (!analyst) return res.status(404).json({ error: 'Analyst not found' });

  const existing = db.prepare('SELECT * FROM fraud_cases WHERE id = ?').get(id) as FraudCaseRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Case not found' });

  db.prepare('UPDATE fraud_cases SET assigned_to = ?, updated_at = ? WHERE id = ?').run(analyst_id, now(), id);

  const user = currentUser(req);
  logAction({
    userId: user.id, userName: user.name,
    action: 'CASE_ASSIGNED', entityType: 'fraud_case', entityId: existing.id,
    oldValue: { assigned_to: existing.assigned_to }, newValue: { assigned_to: analyst_id, analyst_name: analyst.name },
  });

  return res.json({ message: `Case assigned to ${analyst.name}` });
}

function addNote(req: Request, res: Response) {
  const { id } = req.params;
  const { note } = (req.body || {}) as Record<string, unknown>;
  if (typeof note !== 'string' || !note.trim()) return res.status(400).json({ error: 'Note content is required' });

  const caseRow = db.prepare('SELECT id FROM fraud_cases WHERE id = ?').get(id) as { id: number } | undefined;
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  const user = currentUser(req);
  const result = db.prepare(
    'INSERT INTO case_notes (case_id, user_id, note) VALUES (?, ?, ?)'
  ).run(caseRow.id, user.id, note.trim());

  db.prepare('UPDATE fraud_cases SET updated_at = ? WHERE id = ?').run(now(), caseRow.id);

  logAction({
    userId: user.id, userName: user.name,
    action: 'NOTE_ADDED', entityType: 'fraud_case', entityId: caseRow.id,
    newValue: { note_id: result.lastInsertRowid },
  });

  return res.status(201).json({ id: result.lastInsertRowid, message: 'Note added' });
}

function generateSummary(req: Request, res: Response) {
  const { id } = req.params;
  const caseRow = db.prepare(`
    SELECT fc.*, t.amount, t.merchant, t.location, t.risk_level, c.name as customer_name
    FROM fraud_cases fc
    LEFT JOIN transactions t ON fc.transaction_id = t.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE fc.id = ?
  `).get(id) as CaseSummaryRow | undefined;

  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  const notes = db.prepare('SELECT * FROM case_notes WHERE case_id = ?').all(caseRow.id);
  const summary = generateCaseSummary(caseRow, caseRow, notes);

  db.prepare('UPDATE fraud_cases SET summary = ?, updated_at = ? WHERE id = ?').run(summary, now(), caseRow.id);

  const user = currentUser(req);
  logAction({
    userId: user.id, userName: user.name,
    action: 'CASE_SUMMARY_GENERATED', entityType: 'fraud_case', entityId: caseRow.id,
  });

  return res.json({ summary });
}

export { getCases, getCaseById, createCase, updateCaseStatus, assignCase, addNote, generateSummary };
