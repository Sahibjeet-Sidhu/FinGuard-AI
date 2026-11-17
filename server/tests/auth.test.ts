import jwt from 'jsonwebtoken';
import type { AuthUser } from '../src/types';
import { app, db, request, initializeSchema, createUser, loginAs, auth, PASSWORD } from './helpers';

let analyst: AuthUser;

const roleOf = (email: string) =>
  (db.prepare('SELECT role FROM users WHERE email = ?').get(email) as { role: string } | undefined)?.role;

beforeAll(() => {
  initializeSchema();
  analyst = createUser('analyst', 'analyst@finguard.test', 'Jest Analyst');
  createUser('admin', 'admin@finguard.test', 'Jest Admin');
});

describe('POST /api/auth/login', () => {
  it('returns a signed JWT and the user profile for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'Analyst@FinGuard.test', password: PASSWORD }); // email is case-insensitive

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toEqual({ id: analyst.id, name: 'Jest Analyst', email: 'analyst@finguard.test', role: 'analyst' });

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET as string) as jwt.JwtPayload;
    expect(payload).toMatchObject({ id: analyst.id, role: 'analyst' });
    expect(payload.exp).toBeGreaterThan(payload.iat as number);
  });

  it('rejects a wrong password and an unknown email with the same 401', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: analyst.email, password: 'wrongpassword' });
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'nobody@finguard.test', password: PASSWORD });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body); // no hint about which part was wrong
    expect(wrongPassword.body).not.toHaveProperty('token');
  });

  it('rejects missing or malformed credentials with 400', async () => {
    const bodies: object[] = [{}, { email: analyst.email }, { email: { $ne: null }, password: PASSWORD }, { email: analyst.email, password: 12345678 }];
    for (const body of bodies) {
      const res = await request(app).post('/api/auth/login').send(body);
      expect(res.statusCode).toBe(400);
    }
  });
});

describe('POST /api/auth/register', () => {
  it('registers new users as analysts and refuses self-service admin accounts', async () => {
    const created = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new.user@finguard.test', password: 'Secure@123' });
    expect(created.statusCode).toBe(201);
    expect(roleOf('new.user@finguard.test')).toBe('analyst');

    // Anyone can call this endpoint, so it must not hand out the admin role.
    const escalation = { name: 'Mallory', email: 'mallory@finguard.test', password: 'Secure@123', role: 'admin' };
    const anonymous = await request(app).post('/api/auth/register').send(escalation);
    const asAnalyst = await request(app).post('/api/auth/register').set(auth(await loginAs(analyst.email))).send(escalation);
    expect(anonymous.statusCode).toBe(403);
    expect(asAnalyst.statusCode).toBe(403);
    expect(db.prepare('SELECT id FROM users WHERE email = ?').get('mallory@finguard.test')).toBeUndefined();

    // An existing admin can create another admin.
    const asAdmin = await request(app).post('/api/auth/register').set(auth(await loginAs('admin@finguard.test')))
      .send({ ...escalation, name: 'Second Admin', email: 'admin2@finguard.test' });
    expect(asAdmin.statusCode).toBe(201);
    expect(roleOf('admin2@finguard.test')).toBe('admin');
  });

  it('rejects duplicate emails, weak passwords and invalid input', async () => {
    const base = { name: 'Dup', email: 'fresh@finguard.test', password: 'Secure@123' };

    const duplicate = await request(app).post('/api/auth/register').send({ ...base, email: 'ANALYST@finguard.test' });
    expect(duplicate.statusCode).toBe(409);

    for (const invalid of [{ password: 'short' }, { email: 'not-an-email' }, { role: 'superuser' }, { name: '' }]) {
      const res = await request(app).post('/api/auth/register').send({ ...base, ...invalid });
      expect(res.statusCode).toBe(400);
    }
    expect(db.prepare('SELECT id FROM users WHERE email = ?').get('fresh@finguard.test')).toBeUndefined();
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user without the password hash', async () => {
    const res = await request(app).get('/api/auth/me').set(auth(await loginAs(analyst.email)));

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: analyst.id, email: analyst.email, role: 'analyst' });
    expect(res.body).not.toHaveProperty('password_hash');
  });
});
