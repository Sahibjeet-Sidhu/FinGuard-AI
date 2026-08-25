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

const FACTOR_PHRASES = {
  very_high_amount: (f) => `the transaction amount is significantly higher than the customer's historical average spending (${f.description.match(/[\d.]+x/)?.[0] || ''} above baseline)`,
  high_amount: (f) => `the transaction amount is notably elevated compared to the customer's normal spending patterns`,
  unusual_hour: (f) => `the transaction occurred during off-hours when the customer is not typically active`,
  new_location: (f) => `the originating location has not been previously associated with this account`,
  international: (f) => `the transaction originated from a location outside the customer's typical geographic area`,
  suspicious_category: (f) => `the merchant falls within a high-risk category that is frequently associated with fraudulent activity`,
  high_velocity: (f) => `multiple transactions were detected within a compressed time window, a pattern consistent with account takeover`,
  large_cash: (f) => `a large cash withdrawal was initiated, which may indicate structuring or unauthorized access`,
  round_amount: (f) => `the transaction amount is a round number, a pattern sometimes associated with structured transactions`,
};

function generateWithRules(factors, transaction, customer) {
  if (!factors || factors.length === 0) {
    return 'This transaction did not trigger any risk factors and appears within normal parameters.';
  }

  const phrases = factors
    .map(f => FACTOR_PHRASES[f.rule] ? FACTOR_PHRASES[f.rule](f) : f.description)
    .filter(Boolean);

  if (phrases.length === 1) {
    return `This transaction was flagged because ${phrases[0]}.`;
  }

  const last = phrases.pop();
  return `This transaction was flagged because ${phrases.join(', ')} and ${last}. Analyst review is recommended before processing.`;
}

/**
 * Generates a plain-English explanation for a flagged transaction.
 * @param {Object} transaction - The transaction object
 * @param {Array} riskFactors - Array of triggered risk factor objects
 * @param {Object} customer - Customer profile
 */
function generateTransactionExplanation(transaction, riskFactors, customer = {}) {
  // TODO: LLM integration point — replace this block with an async LLM API call
  // Example prompt: `You are a fraud analyst. Explain why this transaction is suspicious based on: ${JSON.stringify(riskFactors)}`
  return generateWithRules(riskFactors, transaction, customer);
}

/**
 * Generates a professional case summary for a fraud investigation.
 * @param {Object} caseData - The fraud case record
 * @param {Object} transactionData - The related transaction
 * @param {Array} notes - Array of case notes
 */
function generateCaseSummary(caseData, transactionData, notes = []) {
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

module.exports = { generateTransactionExplanation, generateCaseSummary };
