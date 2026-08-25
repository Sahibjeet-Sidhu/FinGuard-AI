const request = require('supertest');
const app = require('../src/app');
const db = require('../src/database/db');
const { initializeSchema } = require('../src/database/schema');
const bcrypt = require('bcryptjs');

beforeAll(() => {
  initializeSchema();
  db.exec("DELETE FROM users WHERE email = 'test.jest@finguard.ca'");
  const hash = bcrypt.hashSync('Test@1234', 10);
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
    .run('Jest Tester', 'test.jest@finguard.ca', hash, 'analyst');
});

afterAll(() => {
  db.exec("DELETE FROM users WHERE email = 'test.jest@finguard.ca'");
  db.exec("DELETE FROM users WHERE email = 'new.user.jest@finguard.ca'");
});

describe('POST /api/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test.jest@finguard.ca', password: 'Test@1234' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test.jest@finguard.ca');
    expect(res.body.user.role).toBe('analyst');
  });

  it('rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test.jest@finguard.ca', password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/register', () => {
  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new.user.jest@finguard.ca', password: 'Secure@123', role: 'analyst' });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/registered/i);
  });

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'test.jest@finguard.ca', password: 'Secure@123' });

    expect(res.statusCode).toBe(409);
  });
});

describe('GET /api/auth/me', () => {
  let token;
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test.jest@finguard.ca', password: 'Test@1234' });
    token = res.body.token;
  });

  it('returns current user when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('test.jest@finguard.ca');
  });

  it('rejects requests without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});
