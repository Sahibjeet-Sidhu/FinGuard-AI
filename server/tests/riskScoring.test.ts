import { calculateRiskScore, getRiskLevel } from '../src/services/riskScoringService';
import { generateTransactionExplanation } from '../src/services/aiExplanationService';
import type { CustomerProfile, RiskAssessment, ScorableTransaction } from '../src/types';

const customer: CustomerProfile = {
  usual_location: 'Toronto, ON',
  average_transaction_amount: 300,
};

// A transaction that triggers nothing; each test changes only what it is testing.
const normalTx: ScorableTransaction = {
  amount: 280,
  location: 'Toronto, ON',
  category: 'groceries',
  transaction_time: '2024-01-15T14:00:00.000Z',
  transaction_type: 'purchase',
};

const score = (overrides: Partial<ScorableTransaction> = {}, recent: { id: number }[] = []) =>
  calculateRiskScore({ ...normalTx, ...overrides }, customer, recent);
const factor = (result: RiskAssessment, rule: string) => result.factors.find(f => f.rule === rule);
const rules = (result: RiskAssessment) => result.factors.map(f => f.rule);

describe('getRiskLevel', () => {
  it('maps scores to low, medium, high and critical at every band boundary', () => {
    expect([0, 30].map(getRiskLevel)).toEqual(['low', 'low']);
    expect([31, 60].map(getRiskLevel)).toEqual(['medium', 'medium']);
    expect([61, 80].map(getRiskLevel)).toEqual(['high', 'high']);
    expect([81, 100].map(getRiskLevel)).toEqual(['critical', 'critical']);
  });
});

describe('calculateRiskScore', () => {
  it('scores a normal transaction 0 with no factors and does not flag it', () => {
    const result = score();
    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe('low');
    expect(result.flagged).toBe(false);
    expect(result.factors).toEqual([]);
  });

  it('weights the amount signal in two tiers: +25 at 3x the average, +40 at 5x', () => {
    expect(score({ amount: 899 }).factors).toEqual([]); // just under 3x
    expect(factor(score({ amount: 900 }), 'high_amount')?.points).toBe(25);

    const veryHigh = score({ amount: 1501 });
    expect(factor(veryHigh, 'very_high_amount')?.points).toBe(40);
    expect(factor(veryHigh, 'high_amount')).toBeUndefined(); // tiers never stack
    expect(veryHigh.score).toBe(40);
  });

  it('adds 20 points for transactions between 00:00 and 04:59 UTC', () => {
    expect(factor(score({ transaction_time: '2024-01-15T02:30:00.000Z' }), 'unusual_hour')?.points).toBe(20);
    expect(factor(score({ transaction_time: '2024-01-15T04:59:00.000Z' }), 'unusual_hour')).toBeDefined();
    expect(factor(score({ transaction_time: '2024-01-15T05:00:00.000Z' }), 'unusual_hour')).toBeUndefined();
  });

  it('adds 25 points when the city differs from the customer\'s usual location', () => {
    const result = score({ location: 'Vancouver, BC' });
    expect(rules(result)).toEqual(['new_location']); // domestic: not international
    expect(result.score).toBe(25);
  });

  it('adds 20 points for locations outside Canada, matching the region exactly', () => {
    const newYork = score({ location: 'New York, USA' });
    expect(rules(newYork)).toEqual(['new_location', 'international']);
    expect(newYork.score).toBe(45);

    // Regression: "London" and "Barcelona" contain "on" and were treated as Ontario.
    for (const location of ['London, UK', 'Barcelona, Spain', 'Singapore']) {
      expect(factor(score({ location }), 'international')).toBeDefined();
    }
    for (const location of ['Halifax, NS', 'Quebec City, QC', 'Toronto']) {
      expect(factor(score({ location }), 'international')).toBeUndefined();
    }
  });

  it('adds 20 points for high-risk merchant categories', () => {
    for (const category of ['crypto', 'gambling', 'wire_transfer', 'money_order']) {
      const result = score({ category });
      expect(factor(result, 'suspicious_category')?.points).toBe(20);
      expect(result.score).toBe(20);
    }
    expect(score({ category: 'travel' }).factors).toEqual([]);
  });

  it('adds 30 points for velocity once 3 other transactions fall in the prior hour', () => {
    expect(score({}, [{ id: 1 }, { id: 2 }]).factors).toEqual([]);

    const result = score({}, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(factor(result, 'high_velocity')?.points).toBe(30);
    expect(result.score).toBe(30);
    expect(result.flagged).toBe(false); // 30 is still below the review threshold of 31
  });

  it('adds 15 points for large cash withdrawals and 10 for round-number amounts', () => {
    // Customer with a high average so the amount signal stays out of the way.
    const wealthy: CustomerProfile = { usual_location: 'Toronto, ON', average_transaction_amount: 10000 };
    const withdrawal: ScorableTransaction = { ...normalTx, category: 'cash_withdrawal', transaction_type: 'withdrawal' };

    const large = calculateRiskScore({ ...withdrawal, amount: 5200 }, wealthy);
    expect(large.factors).toEqual([expect.objectContaining({ rule: 'large_cash', points: 15 })]);

    const largeAndRound = calculateRiskScore({ ...withdrawal, amount: 5000 }, wealthy);
    expect(rules(largeAndRound)).toEqual(['large_cash', 'round_amount']);
    expect(largeAndRound.score).toBe(25);

    // A purchase is not a cash withdrawal, and 1250 is not a round amount.
    expect(rules(calculateRiskScore({ ...normalTx, amount: 6000 }, wealthy))).toEqual(['round_amount']);
    expect(calculateRiskScore({ ...normalTx, amount: 1250 }, wealthy).factors).toEqual([]);
  });

  it('caps the score at 100 while the factors still account for every point', () => {
    const result = score({
      amount: 9000, // 30x the average, and a round number
      location: 'Lagos, Nigeria',
      category: 'wire_transfer',
      transaction_time: '2024-01-15T02:00:00.000Z',
      transaction_type: 'international',
    }, [{ id: 1 }, { id: 2 }, { id: 3 }]);

    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe('critical');
    expect(result.flagged).toBe(true);
    expect(rules(result)).toEqual([
      'very_high_amount', 'unusual_hour', 'new_location', 'international',
      'suspicious_category', 'high_velocity', 'round_amount',
    ]);
    const pointsTotal = result.factors.reduce((sum, f) => sum + f.points, 0);
    expect(pointsTotal).toBe(165);
    expect(result.rawScore).toBe(pointsTotal);
  });
});

describe('generateTransactionExplanation', () => {
  it('explains each triggered signal and never claims an unflagged transaction was flagged', () => {
    const flagged = score({ amount: 2000, location: 'London, UK', transaction_time: '2024-01-15T02:00:00.000Z' });
    const text = generateTransactionExplanation(normalTx, flagged.factors, customer, flagged.flagged);
    expect(text).toMatch(/^This transaction was flagged because/);
    expect(text).toMatch(/6\.7x above baseline/);
    expect(text).toMatch(/off-hours/);
    expect(text).toMatch(/not been previously associated/);
    expect(text).toMatch(/outside Canada/);

    const weak = score({ location: 'Vancouver, BC' }); // 25 points: below the threshold
    const weakText = generateTransactionExplanation(normalTx, weak.factors, customer, weak.flagged);
    expect(weakText).toMatch(/was not flagged/);
    expect(weakText).toMatch(/not been previously associated/);

    expect(generateTransactionExplanation(normalTx, [], customer, false)).toMatch(/did not trigger any risk factors/);
  });
});
