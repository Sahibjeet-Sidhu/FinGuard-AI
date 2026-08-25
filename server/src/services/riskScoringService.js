/**
 * Risk Scoring Service
 * Deterministic, rule-based risk scoring engine for transaction analysis.
 * Each rule contributes points to a total risk score (0-100).
 */

const RISK_RULES = {
  HIGH_AMOUNT_MULTIPLIER: { threshold: 3, points: 25, label: 'high_amount' },
  VERY_HIGH_AMOUNT_MULTIPLIER: { threshold: 5, points: 40, label: 'very_high_amount' },
  UNUSUAL_HOUR_EARLY: { start: 0, end: 5, points: 20, label: 'unusual_hour' },
  NEW_LOCATION: { points: 25, label: 'new_location' },
  SUSPICIOUS_CATEGORY: { categories: ['gambling', 'crypto', 'wire_transfer', 'money_order'], points: 20, label: 'suspicious_category' },
  INTERNATIONAL: { points: 20, label: 'international' },
  HIGH_VELOCITY: { windowMinutes: 60, countThreshold: 3, points: 30, label: 'high_velocity' },
  LARGE_CASH: { threshold: 5000, points: 15, label: 'large_cash' },
  ROUND_AMOUNT: { points: 10, label: 'round_amount' },
};

function getRiskLevel(score) {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}

function isRoundAmount(amount) {
  return amount % 500 === 0 && amount >= 1000;
}

function isUnusualHour(transactionTime) {
  const hour = new Date(transactionTime).getUTCHours();
  return hour >= 0 && hour < 5;
}

function isNewLocation(transactionLocation, usualLocation) {
  if (!usualLocation) return false;
  const txCity = transactionLocation.split(',')[0].trim().toLowerCase();
  const usualCity = usualLocation.split(',')[0].trim().toLowerCase();
  return txCity !== usualCity;
}

function isInternational(location) {
  const canadianProvinces = ['on', 'bc', 'ab', 'qc', 'mb', 'sk', 'ns', 'nb', 'nl', 'pe', 'nt', 'nu', 'yt',
    'ontario', 'british columbia', 'alberta', 'quebec', 'manitoba', 'saskatchewan'];
  const loc = location.toLowerCase();
  return !canadianProvinces.some(p => loc.includes(p)) &&
    !['toronto', 'vancouver', 'calgary', 'montreal', 'ottawa', 'edmonton', 'winnipeg', 'halifax'].some(c => loc.includes(c));
}

function isSuspiciousCategory(category) {
  return RISK_RULES.SUSPICIOUS_CATEGORY.categories.some(c =>
    category.toLowerCase().includes(c)
  );
}

/**
 * @param {Object} transaction - The transaction being scored
 * @param {Object} customer - The customer's profile (usual_location, average_transaction_amount)
 * @param {Array} recentTransactions - Transactions in the last 60 mins for velocity check
 */
function calculateRiskScore(transaction, customer, recentTransactions = []) {
  let score = 0;
  const factors = [];

  const avg = customer.average_transaction_amount || 100;
  const multiplier = transaction.amount / avg;

  if (multiplier >= RISK_RULES.VERY_HIGH_AMOUNT_MULTIPLIER.threshold) {
    score += RISK_RULES.VERY_HIGH_AMOUNT_MULTIPLIER.points;
    factors.push({
      rule: 'very_high_amount',
      description: `Amount is ${multiplier.toFixed(1)}x higher than the customer's normal transaction average`,
      points: RISK_RULES.VERY_HIGH_AMOUNT_MULTIPLIER.points,
    });
  } else if (multiplier >= RISK_RULES.HIGH_AMOUNT_MULTIPLIER.threshold) {
    score += RISK_RULES.HIGH_AMOUNT_MULTIPLIER.points;
    factors.push({
      rule: 'high_amount',
      description: `Amount is ${multiplier.toFixed(1)}x higher than the customer's normal transaction average`,
      points: RISK_RULES.HIGH_AMOUNT_MULTIPLIER.points,
    });
  }

  if (isUnusualHour(transaction.transaction_time)) {
    score += RISK_RULES.UNUSUAL_HOUR_EARLY.points;
    const hour = new Date(transaction.transaction_time).getUTCHours();
    factors.push({
      rule: 'unusual_hour',
      description: `Transaction occurred outside the customer's usual activity hours (${hour}:00 UTC)`,
      points: RISK_RULES.UNUSUAL_HOUR_EARLY.points,
    });
  }

  if (isNewLocation(transaction.location, customer.usual_location)) {
    score += RISK_RULES.NEW_LOCATION.points;
    factors.push({
      rule: 'new_location',
      description: `Transaction occurred from a new location (${transaction.location}) not associated with this account`,
      points: RISK_RULES.NEW_LOCATION.points,
    });
  }

  if (isInternational(transaction.location)) {
    score += RISK_RULES.INTERNATIONAL.points;
    factors.push({
      rule: 'international',
      description: `Transaction originated from an international or out-of-province location (${transaction.location})`,
      points: RISK_RULES.INTERNATIONAL.points,
    });
  }

  if (isSuspiciousCategory(transaction.category)) {
    score += RISK_RULES.SUSPICIOUS_CATEGORY.points;
    factors.push({
      rule: 'suspicious_category',
      description: `Merchant category "${transaction.category}" is associated with elevated fraud risk`,
      points: RISK_RULES.SUSPICIOUS_CATEGORY.points,
    });
  }

  if (recentTransactions.length >= RISK_RULES.HIGH_VELOCITY.countThreshold) {
    score += RISK_RULES.HIGH_VELOCITY.points;
    factors.push({
      rule: 'high_velocity',
      description: `${recentTransactions.length} transactions detected within the last 60-minute window — possible velocity abuse`,
      points: RISK_RULES.HIGH_VELOCITY.points,
    });
  }

  if (transaction.transaction_type === 'withdrawal' && transaction.amount >= RISK_RULES.LARGE_CASH.threshold) {
    score += RISK_RULES.LARGE_CASH.points;
    factors.push({
      rule: 'large_cash',
      description: `Large cash withdrawal of $${transaction.amount.toLocaleString()} may indicate structuring`,
      points: RISK_RULES.LARGE_CASH.points,
    });
  }

  if (isRoundAmount(transaction.amount)) {
    score += RISK_RULES.ROUND_AMOUNT.points;
    factors.push({
      rule: 'round_amount',
      description: `Round-number transaction amount ($${transaction.amount.toLocaleString()}) is a common indicator of structuring`,
      points: RISK_RULES.ROUND_AMOUNT.points,
    });
  }

  score = Math.min(score, 100);
  const riskLevel = getRiskLevel(score);

  return {
    score,
    riskLevel,
    factors,
    flagged: score >= 31,
  };
}

module.exports = { calculateRiskScore, getRiskLevel };
