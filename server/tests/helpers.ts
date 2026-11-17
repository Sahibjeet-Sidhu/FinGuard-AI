import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app';
import db from '../src/database/db';
import { initializeSchema } from '../src/database/schema';
import { assessTransaction } from '../src/services/transactionRiskService';
import type { AuthUser, Role, TransactionType } from '../src/types';

const PASSWORD = 'Test@1234';

function createUser(role: Role, email: string, name = `Test ${role}`): AuthUser {
  const hash = bcrypt.hashSync(PASSWORD, 4);
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, hash, role);
  return { id: Number(lastInsertRowid), name, email, role };
}

async function loginAs(email: string, password = PASSWORD): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

interface TestCustomer {
  customerId: number;
  accountId: number;
}

/** One customer (Toronto, $300 average) with a single account. */
function createCustomer(): TestCustomer {
  const customerId = db.prepare(
    'INSERT INTO customers (name, email, usual_location, average_transaction_amount) VALUES (?, ?, ?, ?)'
  ).run('Casey Customer', 'casey@example.com', 'Toronto, ON', 300).lastInsertRowid;
  const accountId = db.prepare(
    'INSERT INTO accounts (customer_id, account_number, account_type, balance) VALUES (?, ?, ?, ?)'
  ).run(customerId, '1000004321', 'chequing', 5000).lastInsertRowid;
  return { customerId: Number(customerId), accountId: Number(accountId) };
}

interface TestTransaction {
  amount: number;
  merchant: string;
  category: string;
  location: string;
  transaction_type: TransactionType;
  transaction_time: string;
}

/** Inserts a transaction and scores it the same way the application does. Returns its ID. */
function createTransaction({ customerId, accountId }: TestCustomer, overrides: Partial<TestTransaction> = {}): number {
  const tx: TestTransaction = {
    amount: 280,
    merchant: 'Loblaws',
    category: 'groceries',
    location: 'Toronto, ON',
    transaction_type: 'purchase',
    transaction_time: '2026-03-10T14:00:00.000Z',
    ...overrides,
  };
  const id = Number(db.prepare(`
    INSERT INTO transactions (customer_id, account_id, amount, merchant, category, location, transaction_type, transaction_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customerId, accountId, tx.amount, tx.merchant, tx.category, tx.location, tx.transaction_type, tx.transaction_time).lastInsertRowid);
  assessTransaction(id);
  return id;
}

export { app, db, request, initializeSchema, createUser, loginAs, auth, createCustomer, createTransaction, PASSWORD };
export type { TestCustomer };
