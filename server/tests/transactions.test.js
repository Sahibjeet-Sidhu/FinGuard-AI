const request = require('supertest');
const app = require('../src/app');
const db = require('../src/database/db');
const bcrypt = require('bcryptjs');
const { initializeSchema } = require('../src/database/schema');

let token;

beforeAll(async () => {
  initializeSchema();
  db.exec("DELETE FROM users WHERE email = 'tx.jest@finguard.ca'");
  const hash = bcrypt.hashSync('Test@1234', 10);
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
    .run('TX Tester', 'tx.jest@finguard.ca', hash, 'analyst');

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'tx.jest@finguard.ca', password: 'Test@1234' });
  token = res.body.token;
});

afterAll(() => {
  db.exec("DELETE FROM users WHERE email = 'tx.jest@finguard.ca'");
});

describe('GET /api/transactions', () => {
  it('returns paginated transactions for authenticated users', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.statusCode).toBe(401);
  });

  it('filters by risk level', async () => {
    const res = await request(app)
      .get('/api/transactions?riskLevel=critical')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    res.body.data.forEach(tx => {
      expect(tx.risk_level).toBe('critical');
    });
  });

  it('filters flagged transactions only', async () => {
    const res = await request(app)
      .get('/api/transactions?flagged=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    res.body.data.forEach(tx => {
      expect(tx.flagged).toBe(1);
    });
  });
});

describe('GET /api/transactions/:id', () => {
  it('returns transaction details by ID', async () => {
    const firstRes = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    const txId = firstRes.body.data[0]?.id;
    if (!txId) return;

    const res = await request(app)
      .get(`/api/transactions/${txId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(txId);
  });

  it('returns 404 for non-existent transaction', async () => {
    const res = await request(app)
      .get('/api/transactions/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
  });
});
