/**
 * Risk Scoring Service
 * Deterministic, rule-based risk scoring engine for transaction analysis.
 * Each triggered signal contributes a fixed weight to a total score (0-100),
 * and every contribution is returned so the score can be explained.
 */

import type { CustomerProfile, RiskAssessment, RiskFactor, RiskLevel, ScorableTransaction } from '../types';

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
} as const;

const MAX_SCORE = 100;
const FLAG_THRESHOLD = 31;

const CANADIAN_REGIONS: ReadonlySet<string> = new Set([
  'on', 'bc', 'ab', 'qc', 'mb', 'sk', 'ns', 'nb', 'nl', 'pe', 'nt', 'nu', 'yt',
  'ontario', 'british columbia', 'alberta', 'quebec', 'manitoba', 'saskatchewan',
  'nova scotia', 'new brunswick', 'newfoundland and labrador', 'prince edward island',
  'northwest territories', 'nunavut', 'yukon', 'canada',
]);

const CANADIAN_CITIES: ReadonlySet<string> = new Set([
  'toronto', 'vancouver', 'calgary', 'montreal', 'ottawa', 'edmonton', 'winnipeg', 'halifax',
  'mississauga', 'brampton', 'burnaby', 'quebec city', 'hamilton', 'victoria', 'saskatoon', 'regina',
]);

function getRiskLevel(score: number): RiskLevel {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}

function isRoundAmount(amount: number): boolean {
  return amount % 500 === 0 && amount >= 1000;
}

function isUnusualHour(transactionTime: string): boolean {
  const hour = new Date(transactionTime).getUTCHours();
  return hour >= RISK_RULES.UNUSUAL_HOUR_EARLY.start && hour < RISK_RULES.UNUSUAL_HOUR_EARLY.end;
}

function locationParts(location: string | null | undefined): string[] {
  return String(location || '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
}

function isNewLocation(transactionLocation: string, usualLocation: string | undefined): boolean {
  const tx = locationParts(transactionLocation);
  const usual = locationParts(usualLocation);
  if (tx.length === 0 || usual.length === 0) return false;
  return tx[0] !== usual[0];
}

/**
 * A location is international when its region (the part after the last comma)
 * is not a Canadian province or territory. Regions are compared as whole
 * tokens: substring matching would treat "London, UK" as Ontario ("on").
 */
function isInternational(location: string): boolean {
  const parts = locationParts(location);
  if (parts.length === 0) return false;
  if (parts.length === 1) {
    return !CANADIAN_CITIES.has(parts[0]) && !CANADIAN_REGIONS.has(parts[0]);
  }
  return !CANADIAN_REGIONS.has(parts[parts.length - 1]);
}

function isSuspiciousCategory(category: string): boolean {
  const cat = String(category || '').toLowerCase();
  return RISK_RULES.SUSPICIOUS_CATEGORY.categories.some(c => cat.includes(c));
}

/**
 * @param transaction - The transaction being scored
 * @param customer - The customer's profile (usual location, average transaction amount)
 * @param recentTransactions - The customer's other transactions in the preceding 60 minutes
 */
function calculateRiskScore(
  transaction: ScorableTransaction,
  customer: CustomerProfile = {},
  recentTransactions: readonly unknown[] = [],
): RiskAssessment {
  let rawScore = 0;
  const factors: RiskFactor[] = [];
  const add = (rule: string, points: number, description: string) => {
    rawScore += points;
    factors.push({ rule, description, points });
  };

  const amount = Number(transaction.amount) || 0;
  const avg = customer.average_transaction_amount || 100;
  const multiplier = amount / avg;

  if (multiplier >= RISK_RULES.VERY_HIGH_AMOUNT_MULTIPLIER.threshold) {
    add('very_high_amount', RISK_RULES.VERY_HIGH_AMOUNT_MULTIPLIER.points,
      `Amount is ${multiplier.toFixed(1)}x higher than the customer's normal transaction average`);
  } else if (multiplier >= RISK_RULES.HIGH_AMOUNT_MULTIPLIER.threshold) {
    add('high_amount', RISK_RULES.HIGH_AMOUNT_MULTIPLIER.points,
      `Amount is ${multiplier.toFixed(1)}x higher than the customer's normal transaction average`);
  }

  if (isUnusualHour(transaction.transaction_time)) {
    const hour = new Date(transaction.transaction_time).getUTCHours();
    add('unusual_hour', RISK_RULES.UNUSUAL_HOUR_EARLY.points,
      `Transaction occurred outside the customer's usual activity hours (${hour}:00 UTC)`);
  }

  if (isNewLocation(transaction.location, customer.usual_location)) {
    add('new_location', RISK_RULES.NEW_LOCATION.points,
      `Transaction occurred from a new location (${transaction.location}) not associated with this account`);
  }

  if (isInternational(transaction.location)) {
    add('international', RISK_RULES.INTERNATIONAL.points,
      `Transaction originated outside Canada (${transaction.location})`);
  }

  if (isSuspiciousCategory(transaction.category)) {
    add('suspicious_category', RISK_RULES.SUSPICIOUS_CATEGORY.points,
      `Merchant category "${transaction.category}" is associated with elevated fraud risk`);
  }

  if (recentTransactions.length >= RISK_RULES.HIGH_VELOCITY.countThreshold) {
    add('high_velocity', RISK_RULES.HIGH_VELOCITY.points,
      `${recentTransactions.length} other transactions on this account in the preceding 60 minutes — possible velocity abuse`);
  }

  if (transaction.transaction_type === 'withdrawal' && amount >= RISK_RULES.LARGE_CASH.threshold) {
    add('large_cash', RISK_RULES.LARGE_CASH.points,
      `Large cash withdrawal of $${amount.toLocaleString('en-CA')} may indicate structuring`);
  }

  if (isRoundAmount(amount)) {
    add('round_amount', RISK_RULES.ROUND_AMOUNT.points,
      `Round-number transaction amount ($${amount.toLocaleString('en-CA')}) is a common indicator of structuring`);
  }

  const score = Math.min(rawScore, MAX_SCORE);

  return {
    score,
    rawScore,
    riskLevel: getRiskLevel(score),
    factors,
    flagged: score >= FLAG_THRESHOLD,
  };
}

export { calculateRiskScore, getRiskLevel, isInternational, RISK_RULES, MAX_SCORE, FLAG_THRESHOLD };
