/**
 * Transaction Risk Service
 * Scores a stored transaction against its customer's profile and recent
 * activity, then persists the score together with the factor breakdown and
 * explanation. The seed script and the recalculate endpoint both go through
 * here, so a transaction always scores the same way.
 */

import db from '../database/db';
import { calculateRiskScore, RISK_RULES } from './riskScoringService';
import { generateTransactionExplanation } from './aiExplanationService';
import type { CustomerRow, RiskAssessment, RiskFactor, RiskLevel, TransactionRow } from '../types';

export interface StoredAssessment extends RiskAssessment {
  explanation: string;
  /** The score the transaction had before this assessment. */
  previous: { score: number; riskLevel: RiskLevel };
}

function parseFactors(json: string | null | undefined): RiskFactor[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as RiskFactor[]) : [];
  } catch {
    return [];
  }
}

/**
 * The customer's other transactions in the 60 minutes up to and including
 * this transaction's timestamp (simultaneous transactions count).
 */
function getVelocityWindow(transaction: TransactionRow): { id: number }[] {
  const windowMs = RISK_RULES.HIGH_VELOCITY.windowMinutes * 60 * 1000;
  const windowStart = new Date(new Date(transaction.transaction_time).getTime() - windowMs).toISOString();
  return db.prepare(`
    SELECT id FROM transactions
    WHERE customer_id = ? AND id != ? AND transaction_time > ? AND transaction_time <= ?
  `).all(transaction.customer_id, transaction.id, windowStart, transaction.transaction_time) as { id: number }[];
}

/**
 * Scores the transaction and saves the result.
 * @returns The assessment, or null if the transaction does not exist
 */
function assessTransaction(transactionId: number | bigint | string): StoredAssessment | null {
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as TransactionRow | undefined;
  if (!transaction) return null;

  const customer = (db.prepare('SELECT * FROM customers WHERE id = ?').get(transaction.customer_id) as CustomerRow | undefined) ?? {};
  const result = calculateRiskScore(transaction, customer, getVelocityWindow(transaction));
  const explanation = generateTransactionExplanation(transaction, result.factors, customer, result.flagged);

  db.prepare(
    'UPDATE transactions SET risk_score = ?, risk_level = ?, flagged = ?, explanation = ?, risk_factors = ? WHERE id = ?'
  ).run(result.score, result.riskLevel, result.flagged ? 1 : 0, explanation, JSON.stringify(result.factors), transaction.id);

  return {
    ...result,
    explanation,
    previous: { score: transaction.risk_score, riskLevel: transaction.risk_level },
  };
}

export { assessTransaction, parseFactors };
