import type { Response } from 'supertest';
import { app, db, request, initializeSchema, createUser, loginAs, auth, createCustomer, createTransaction } from './helpers';
import type { TestCustomer } from './helpers';
import type { AuditLogRow, AuthUser, TransactionRow } from '../src/types';

let token: string;
let analyst: AuthUser;
let customer: TestCustomer;
let normalId: number, mediumId: number, criticalId: number;

const ids = (res: Response) => (res.body.data as { id: number }[]).map(tx => tx.id);

beforeAll(async () => {
  initializeSchema();
  analyst = createUser('analyst', 'analyst@finguard.test', 'Jest Analyst');
  token = await loginAs(analyst.email);

  customer = createCustomer(); // Toronto, $300 average
  normalId = createTransaction(customer);
  mediumId = createTransaction(customer, {
    amount: 950, merchant: 'Best Buy Canada', category: 'electronics',
    location: 'Vancouver, BC', transaction_time: '2026-03-11T15:00:00.000Z',
  });
  criticalId = createTransaction(customer, {
    amount: 9000, merchant: 'Wire Transfer Co', category: 'wire_transfer',
    location: 'Lagos, Nigeria', transaction_type: 'international', transaction_time: '2026-03-12T02:00:00.000Z',
  });
});

describe('GET /api/transactions', () => {
  it('returns paginated, filterable transactions with masked account numbers', async () => {
    const page1 = await request(app).get('/api/transactions?limit=2&sortBy=risk_score&sortDir=desc').set(auth(token));
    expect(page1.statusCode).toBe(200);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, total: 3, pages: 2 });
    expect(ids(page1)).toEqual([criticalId, mediumId]);
    expect((page1.body.data as { account_number: string }[]).every(tx => tx.account_number === '****4321')).toBe(true);

    const page2 = await request(app).get('/api/transactions?limit=2&page=2&sortBy=risk_score&sortDir=desc').set(auth(token));
    expect(ids(page2)).toEqual([normalId]);

    const critical = await request(app).get('/api/transactions?riskLevel=critical').set(auth(token));
    expect(ids(critical)).toEqual([criticalId]);

    const flagged = await request(app).get('/api/transactions?flagged=true').set(auth(token));
    expect(ids(flagged).sort()).toEqual([mediumId, criticalId].sort());

    const search = await request(app).get('/api/transactions?search=best%20buy').set(auth(token));
    expect(ids(search)).toEqual([mediumId]);

    // Non-numeric paging falls back to defaults instead of failing.
    const junk = await request(app).get('/api/transactions?page=abc&limit=xyz').set(auth(token));
    expect(junk.statusCode).toBe(200);
    expect(junk.body.pagination).toMatchObject({ page: 1, limit: 20 });
  });
});

describe('GET /api/transactions/:id', () => {
  it('returns the score with the factor breakdown that explains it, and 404 for unknown IDs', async () => {
    const res = await request(app).get(`/api/transactions/${mediumId}`).set(auth(token));

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: mediumId, risk_score: 50, risk_level: 'medium', flagged: 1, account_number: '****4321' });
    expect(res.body.risk_factors).toEqual([
      { rule: 'high_amount', points: 25, description: expect.stringContaining('3.2x higher') },
      { rule: 'new_location', points: 25, description: expect.stringContaining('Vancouver, BC') },
    ]);
    // The points shown to the analyst add up to the score they are explaining.
    const points = (res.body.risk_factors as { points: number }[]).reduce((sum, f) => sum + f.points, 0);
    expect(points).toBe(res.body.risk_score);
    expect(res.body.explanation).toMatch(/^This transaction was flagged because/);

    const clean = await request(app).get(`/api/transactions/${normalId}`).set(auth(token));
    expect(clean.body).toMatchObject({ risk_score: 0, risk_level: 'low', flagged: 0, risk_factors: [] });

    const viewed = db.prepare("SELECT user_id, entity_id FROM audit_logs WHERE action = 'TRANSACTION_VIEWED' ORDER BY id").all();
    expect(viewed).toEqual([{ user_id: analyst.id, entity_id: mediumId }, { user_id: analyst.id, entity_id: normalId }]);

    const missing = await request(app).get('/api/transactions/999999').set(auth(token));
    expect(missing.statusCode).toBe(404);
  });
});

describe('POST /api/transactions/:id/recalculate-risk', () => {
  it('re-scores from current account activity, saves the result and audits the change', async () => {
    // Three more purchases land in the 60 minutes before the normal transaction (14:00).
    for (const minute of ['13:10', '13:35', '13:58']) {
      createTransaction(customer, { amount: 45, transaction_time: `2026-03-10T${minute}:00.000Z` });
    }
    // One that is just outside the window must not count.
    createTransaction(customer, { amount: 45, transaction_time: '2026-03-10T13:00:00.000Z' });

    const res = await request(app).post(`/api/transactions/${normalId}/recalculate-risk`).set(auth(token));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ score: 30, riskLevel: 'low', flagged: false });
    expect(res.body.factors).toEqual([
      { rule: 'high_velocity', points: 30, description: expect.stringContaining('3 other transactions') },
    ]);

    const stored = db.prepare(
      'SELECT risk_score, risk_level, flagged, risk_factors, explanation FROM transactions WHERE id = ?'
    ).get(normalId) as TransactionRow;
    expect(stored).toMatchObject({ risk_score: 30, risk_level: 'low', flagged: 0, explanation: res.body.explanation });
    expect(JSON.parse(stored.risk_factors as string)).toEqual(res.body.factors);

    const [entry] = db.prepare("SELECT * FROM audit_logs WHERE action = 'RISK_RECALCULATED'").all() as AuditLogRow[];
    expect(entry).toMatchObject({ user_id: analyst.id, entity_type: 'transaction', entity_id: normalId });
    expect(JSON.parse(entry.old_value as string)).toEqual({ risk_score: 0, risk_level: 'low' });
    expect(JSON.parse(entry.new_value as string)).toEqual({ risk_score: 30, risk_level: 'low' });

    const missing = await request(app).post('/api/transactions/999999/recalculate-risk').set(auth(token));
    expect(missing.statusCode).toBe(404);
  });
});
