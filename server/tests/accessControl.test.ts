import jwt from 'jsonwebtoken';
import type { AuditLogRow, AuthUser } from '../src/types';
import { app, db, request, initializeSchema, createUser, loginAs, auth, createCustomer, createTransaction } from './helpers';

let admin: AuthUser, analyst: AuthUser;
let adminToken: string, analystToken: string;
let caseId: number, transactionId: number;

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

const SECRET = process.env.JWT_SECRET as string;

const auditEntries = (action: string) =>
  db.prepare('SELECT * FROM audit_logs WHERE action = ? ORDER BY id').all(action) as AuditLogRow[];

const assignedTo = (id: number) =>
  (db.prepare('SELECT assigned_to FROM fraud_cases WHERE id = ?').get(id) as { assigned_to: number | null }).assigned_to;

beforeAll(async () => {
  initializeSchema();
  admin = createUser('admin', 'admin@finguard.test', 'Jest Admin');
  analyst = createUser('analyst', 'analyst@finguard.test', 'Jest Analyst');
  adminToken = await loginAs(admin.email);
  analystToken = await loginAs(analyst.email);

  const customer = createCustomer();
  transactionId = createTransaction(customer, {
    amount: 9000, merchant: 'Wire Transfer Co', category: 'wire_transfer',
    location: 'Lagos, Nigeria', transaction_type: 'international', transaction_time: '2026-03-10T02:00:00.000Z',
  });
  caseId = Number(db.prepare('INSERT INTO fraud_cases (transaction_id) VALUES (?)').run(transactionId).lastInsertRowid);
});

describe('authentication', () => {
  it('rejects every protected route without a valid, current token', async () => {
    const routes: [HttpMethod, string][] = [
      ['get', '/api/auth/me'],
      ['get', '/api/transactions'],
      ['get', `/api/transactions/${transactionId}`],
      ['post', `/api/transactions/${transactionId}/recalculate-risk`],
      ['get', '/api/cases'],
      ['post', '/api/cases'],
      ['put', `/api/cases/${caseId}/status`],
      ['put', `/api/cases/${caseId}/assign`],
      ['get', '/api/analytics/summary'],
      ['get', '/api/audit-logs'],
      ['get', '/api/users/analysts'],
    ];
    for (const [method, path] of routes) {
      const res = await request(app)[method](path);
      expect([path, res.statusCode]).toEqual([path, 401]);
    }

    const claims = { id: admin.id, name: admin.name, email: admin.email, role: 'admin' };
    const ghost = createUser('admin', 'ghost@finguard.test');
    const ghostToken = await loginAs(ghost.email);
    db.prepare('DELETE FROM users WHERE id = ?').run(ghost.id);

    const badTokens = {
      malformed: 'not-a-jwt',
      forged: jwt.sign(claims, 'some-other-secret'),
      expired: jwt.sign(claims, SECRET, { expiresIn: -10 }),
      unsigned: jwt.sign(claims, '', { algorithm: 'none' }),
      'deleted user': ghostToken,
    };
    for (const [kind, token] of Object.entries(badTokens)) {
      const res = await request(app).get('/api/audit-logs').set(auth(token));
      expect([kind, res.statusCode]).toEqual([kind, 401]);
    }
  });
});

describe('role-based access control', () => {
  it('denies analysts the admin-only routes with 403 and changes nothing', async () => {
    const logs = await request(app).get('/api/audit-logs').set(auth(analystToken));
    expect(logs.statusCode).toBe(403);
    expect(logs.body).not.toHaveProperty('data');

    const assign = await request(app).put(`/api/cases/${caseId}/assign`).set(auth(analystToken)).send({ analyst_id: analyst.id });
    expect(assign.statusCode).toBe(403);
    expect(assignedTo(caseId)).toBeNull();

    // A token whose claims say "admin" is not enough: the role comes from the database.
    db.prepare("UPDATE users SET role = 'analyst' WHERE id = ?").run(admin.id);
    const demoted = await request(app).get('/api/audit-logs').set(auth(adminToken));
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(admin.id);
    expect(demoted.statusCode).toBe(403);
  });

  it('lets admins read the audit log and assign cases, and analysts work their cases', async () => {
    const logs = await request(app).get('/api/audit-logs').set(auth(adminToken));
    expect(logs.statusCode).toBe(200);
    expect(logs.body.data.length).toBeGreaterThan(0);
    expect(logs.body.pagination.total).toBe(logs.body.data.length);

    const assign = await request(app).put(`/api/cases/${caseId}/assign`).set(auth(adminToken)).send({ analyst_id: analyst.id });
    expect(assign.statusCode).toBe(200);
    expect(assignedTo(caseId)).toBe(analyst.id);

    const note = await request(app).post(`/api/cases/${caseId}/notes`).set(auth(analystToken)).send({ note: 'Called the customer.' });
    expect(note.statusCode).toBe(201);
  });
});

describe('audit log', () => {
  it('records who did what, with the values before and after the change', async () => {
    const res = await request(app).put(`/api/cases/${caseId}/status`).set(auth(analystToken))
      .send({ status: 'Resolved', resolution: 'Confirmed fraud. Card reissued.' });
    expect(res.statusCode).toBe(200);

    const [statusChange] = auditEntries('CASE_STATUS_CHANGED');
    expect(statusChange).toMatchObject({ user_id: analyst.id, user_name: 'Jest Analyst', entity_type: 'fraud_case', entity_id: caseId });
    expect(JSON.parse(statusChange.old_value as string)).toEqual({ status: 'New', resolution: null });
    expect(JSON.parse(statusChange.new_value as string)).toEqual({ status: 'Resolved', resolution: 'Confirmed fraud. Card reissued.' });
    expect(new Date(statusChange.created_at).toISOString()).toBe(statusChange.created_at); // ISO-8601 UTC

    // Earlier actions in this file were logged too, each attributed to its actor.
    expect(auditEntries('USER_LOGIN').map(e => e.user_id)).toEqual(expect.arrayContaining([admin.id, analyst.id]));
    expect(auditEntries('CASE_ASSIGNED')[0]).toMatchObject({ user_id: admin.id, entity_id: caseId });
    expect(auditEntries('NOTE_ADDED')[0]).toMatchObject({ user_id: analyst.id, entity_id: caseId });
  });

  it('is append-only: the database rejects updates and deletes of audit entries', async () => {
    const before = db.prepare('SELECT * FROM audit_logs ORDER BY id').all() as AuditLogRow[];
    expect(before.length).toBeGreaterThan(0);

    expect(() => db.prepare("UPDATE audit_logs SET user_name = 'Someone Else' WHERE id = ?").run(before[0].id))
      .toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM audit_logs WHERE id = ?').run(before[0].id)).toThrow(/append-only/);
    expect(() => db.exec('DELETE FROM audit_logs')).toThrow(/append-only/);

    expect(db.prepare('SELECT * FROM audit_logs ORDER BY id').all()).toEqual(before);

    // The API exposes no way to change the log either.
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      const res = await request(app)[method]('/api/audit-logs').set(auth(adminToken)).send({});
      expect(res.statusCode).toBe(404);
    }
    expect((db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get() as { n: number }).n).toBe(before.length);
  });
});
