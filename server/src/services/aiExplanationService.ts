/**
 * AI Explanation Service
 * Generates analyst-style natural language explanations for flagged transactions.
 * Currently rule-based. LLM integration point is marked with TODO comments.
 *
 * To integrate an LLM (e.g., Claude, OpenAI GPT):
 * TODO: Replace generateWithRules() calls with an LLM API call, passing
 *       the factors array and transaction data as a structured prompt.
 *       Ensure PII is masked before sending to external APIs.
 */

import type { CustomerProfile, RiskFactor, ScorableTransaction } from '../types';

const FACTOR_PHRASES: Record<string, (factor: RiskFactor) => string> = {
  very_high_amount: (f) => `the transaction amount is significantly higher than the customer's historical average spending (${f.description.match(/[\d.]+x/)?.[0] || ''} above baseline)`,
  high_amount: () => `the transaction amount is notably elevated compared to the customer's normal spending patterns`,
  unusual_hour: () => `the transaction occurred during off-hours when the customer is not typically active`,
  new_location: () => `the originating location has not been previously associated with this account`,
  international: () => `the transaction originated outside Canada, away from the customer's home region`,
  suspicious_category: () => `the merchant falls within a high-risk category that is frequently associated with fraudulent activity`,
  high_velocity: () => `multiple transactions were detected within a compressed time window, a pattern consistent with account takeover`,
  large_cash: () => `a large cash withdrawal was initiated, which may indicate structuring or unauthorized access`,
  round_amount: () => `the transaction amount is a round number, a pattern sometimes associated with structured transactions`,
};

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
}

function generateWithRules(factors: RiskFactor[], flagged: boolean): string {
  if (!factors || factors.length === 0) {
    return 'This transaction did not trigger any risk factors and appears within normal parameters.';
  }

  const phrases = factors
    .map(f => (FACTOR_PHRASES[f.rule] ? FACTOR_PHRASES[f.rule](f) : f.description))
    .filter(Boolean);

  // A weak signal on its own does not reach the review threshold, so the
  // wording must not claim the transaction was flagged.
  if (!flagged) {
    return `This transaction was not flagged: its risk score is below the review threshold. For context, ${joinPhrases(phrases)}.`;
  }

  if (phrases.length === 1) {
    return `This transaction was flagged because ${phrases[0]}.`;
  }

  return `This transaction was flagged because ${joinPhrases(phrases)}. Analyst review is recommended before processing.`;
}

/**
 * Generates a plain-English explanation for a scored transaction.
 * @param _transaction - The transaction (reserved for the LLM prompt)
 * @param riskFactors - The triggered risk factors
 * @param _customer - Customer profile (reserved for the LLM prompt)
 * @param flagged - Whether the score reached the review threshold
 */
function generateTransactionExplanation(
  _transaction: ScorableTransaction,
  riskFactors: RiskFactor[],
  _customer: CustomerProfile = {},
  flagged = true,
): string {
  // TODO: LLM integration point — replace this block with an async LLM API call
  // Example prompt: `You are a fraud analyst. Explain why this transaction is suspicious based on: ${JSON.stringify(riskFactors)}`
  return generateWithRules(riskFactors, flagged);
}

/** The case fields the summary reads. */
export interface CaseSummaryCase {
  status?: string | null;
  resolution?: string | null;
}

/** The transaction fields the summary reads. */
export interface CaseSummaryTransaction {
  customer_name?: string | null;
  amount?: number | null;
  merchant?: string | null;
  location?: string | null;
  risk_level?: string | null;
}

/**
 * Generates a professional case summary for a fraud investigation.
 * @param caseData - The fraud case record
 * @param transactionData - The related transaction
 * @param notes - The case's investigation notes
 */
function generateCaseSummary(
  caseData: CaseSummaryCase,
  transactionData: CaseSummaryTransaction,
  notes: readonly unknown[] = [],
): string {
  // TODO: LLM integration point — pass caseData + transactionData + notes as context to an LLM
  const customerName = transactionData.customer_name || 'the customer';
  const amount = transactionData.amount ? `$${Number(transactionData.amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}` : 'an undisclosed amount';
  const merchant = transactionData.merchant || 'an unknown merchant';
  const location = transactionData.location || 'an unknown location';
  const riskLevel = (transactionData.risk_level || 'unknown').toUpperCase();
  const status = caseData.status || 'Under Review';
  const noteCount = notes.length;

  const riskStatement = riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
    ? `The associated transaction carries a ${riskLevel} risk rating, warranting immediate attention.`
    : `The associated transaction carries a ${riskLevel} risk rating.`;

  const noteStatement = noteCount > 0
    ? `The investigation file contains ${noteCount} analyst note${noteCount > 1 ? 's' : ''} documenting the review progress.`
    : 'No analyst notes have been recorded for this case yet.';

  const statusStatement = status === 'Resolved'
    ? `This case has been resolved. Resolution: ${caseData.resolution || 'Not specified'}.`
    : status === 'False Positive'
    ? 'This case was reviewed and determined to be a false positive. No fraudulent activity was confirmed.'
    : `This case is currently in "${status}" status and requires continued monitoring.`;

  return `Case Summary — ${new Date().toLocaleDateString('en-CA')}: ` +
    `A fraud investigation has been initiated for a transaction of ${amount} charged to ${merchant} in ${location}, ` +
    `originating from the account of ${customerName}. ` +
    `${riskStatement} ` +
    `${noteStatement} ` +
    `${statusStatement}`;
}

export { generateTransactionExplanation, generateCaseSummary };
