const { calculateRiskScore, getRiskLevel } = require('../src/services/riskScoringService');

const baseCustomer = {
  usual_location: 'Toronto, ON',
  average_transaction_amount: 300,
};

describe('getRiskLevel', () => {
  it('returns low for 0-30', () => {
    expect(getRiskLevel(0)).toBe('low');
    expect(getRiskLevel(30)).toBe('low');
  });
  it('returns medium for 31-60', () => {
    expect(getRiskLevel(31)).toBe('medium');
    expect(getRiskLevel(60)).toBe('medium');
  });
  it('returns high for 61-80', () => {
    expect(getRiskLevel(61)).toBe('high');
    expect(getRiskLevel(80)).toBe('high');
  });
  it('returns critical for 81-100', () => {
    expect(getRiskLevel(81)).toBe('critical');
    expect(getRiskLevel(100)).toBe('critical');
  });
});

describe('calculateRiskScore', () => {
  it('gives low score for normal transaction', () => {
    const tx = {
      amount: 280,
      location: 'Toronto, ON',
      category: 'groceries',
      transaction_time: new Date().toISOString().replace('T', 'T').replace(/:\d{2}\.\d{3}Z/, ':00'),
      transaction_type: 'purchase',
    };
    const localTx = { ...tx };
    const d = new Date(tx.transaction_time);
    d.setUTCHours(14); // 2pm UTC - business hours
    localTx.transaction_time = d.toISOString();

    const result = calculateRiskScore(localTx, baseCustomer, []);
    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.riskLevel).toBe('low');
    expect(result.flagged).toBe(false);
  });

  it('adds points for very high amount', () => {
    const tx = {
      amount: 2000, // 6.6x average of 300
      location: 'Toronto, ON',
      category: 'groceries',
      transaction_time: '2024-01-15T14:00:00.000Z',
      transaction_type: 'purchase',
    };
    const result = calculateRiskScore(tx, baseCustomer, []);
    const amountFactor = result.factors.find(f => f.rule === 'very_high_amount' || f.rule === 'high_amount');
    expect(amountFactor).toBeDefined();
    expect(result.score).toBeGreaterThan(30);
  });

  it('adds points for unusual late-night hour', () => {
    const tx = {
      amount: 250,
      location: 'Toronto, ON',
      category: 'groceries',
      transaction_time: '2024-01-15T02:30:00.000Z', // 2:30 AM UTC
      transaction_type: 'purchase',
    };
    const result = calculateRiskScore(tx, baseCustomer, []);
    const hourFactor = result.factors.find(f => f.rule === 'unusual_hour');
    expect(hourFactor).toBeDefined();
  });

  it('adds points for new location', () => {
    const tx = {
      amount: 250,
      location: 'Vancouver, BC', // different from Toronto
      category: 'groceries',
      transaction_time: '2024-01-15T14:00:00.000Z',
      transaction_type: 'purchase',
    };
    const result = calculateRiskScore(tx, baseCustomer, []);
    const locFactor = result.factors.find(f => f.rule === 'new_location');
    expect(locFactor).toBeDefined();
  });

  it('flags international transactions', () => {
    const tx = {
      amount: 250,
      location: 'New York, USA',
      category: 'travel',
      transaction_time: '2024-01-15T14:00:00.000Z',
      transaction_type: 'purchase',
    };
    const result = calculateRiskScore(tx, baseCustomer, []);
    const intlFactor = result.factors.find(f => f.rule === 'international');
    expect(intlFactor).toBeDefined();
  });

  it('flags suspicious categories', () => {
    const tx = {
      amount: 250,
      location: 'Toronto, ON',
      category: 'crypto',
      transaction_time: '2024-01-15T14:00:00.000Z',
      transaction_type: 'purchase',
    };
    const result = calculateRiskScore(tx, baseCustomer, []);
    const catFactor = result.factors.find(f => f.rule === 'suspicious_category');
    expect(catFactor).toBeDefined();
  });

  it('flags high velocity with 3+ recent transactions', () => {
    const tx = {
      amount: 250,
      location: 'Toronto, ON',
      category: 'e-commerce',
      transaction_time: '2024-01-15T14:00:00.000Z',
      transaction_type: 'purchase',
    };
    const recentTxns = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = calculateRiskScore(tx, baseCustomer, recentTxns);
    const velocityFactor = result.factors.find(f => f.rule === 'high_velocity');
    expect(velocityFactor).toBeDefined();
  });

  it('scores critical transactions near 100', () => {
    const tx = {
      amount: 9000, // 30x average
      location: 'Lagos, Nigeria',
      category: 'wire_transfer',
      transaction_time: '2024-01-15T02:00:00.000Z', // late night
      transaction_type: 'international',
    };
    const result = calculateRiskScore(tx, baseCustomer, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(result.score).toBeGreaterThanOrEqual(81);
    expect(result.riskLevel).toBe('critical');
    expect(result.flagged).toBe(true);
  });
});
