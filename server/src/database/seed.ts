import '../config/env';
import bcrypt from 'bcryptjs';
import db from './db';
import { resetSchema } from './schema';
import { assessTransaction } from '../services/transactionRiskService';
import type { CasePriority, CaseStatus, RiskLevel, TransactionType } from '../types';

interface SeedCustomer {
  id: number;
  name: string;
  email: string;
  usual_location: string;
  avg: number;
}

// Rebuild from scratch. Dropping the tables is the only way to clear the
// append-only audit log, and it also resets the auto-increment IDs.
resetSchema();

// Fixed-seed PRNG so every run produces the same demo dataset.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260512);

// ─── Users ───────────────────────────────────────────────────────────────────
const users = [
  { name: 'Admin User', email: 'admin@finguard.ca', password: 'Admin@1234', role: 'admin' },
  { name: 'Analyst User', email: 'analyst@finguard.ca', password: 'Analyst@1234', role: 'analyst' },
  { name: 'Marcus Williams', email: 'marcus.w@finguard.ca', password: 'Analyst@1234', role: 'analyst' },
  { name: 'Priya Sharma', email: 'priya.s@finguard.ca', password: 'Analyst@1234', role: 'analyst' },
];

const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
const userIds: Record<string, number> = {};
for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  const r = insertUser.run(u.name, u.email, hash, u.role);
  userIds[u.email] = Number(r.lastInsertRowid);
}
console.log('✓ Users seeded');

// ─── Customers ───────────────────────────────────────────────────────────────
const customers = [
  { name: 'James Thornton',    email: 'j.thornton@email.ca',  usual_location: 'Toronto, ON',     avg: 320 },
  { name: 'Aisha Patel',       email: 'aisha.p@webmail.ca',   usual_location: 'Vancouver, BC',   avg: 185 },
  { name: 'Robert Dubois',     email: 'r.dubois@outlook.ca',  usual_location: 'Montreal, QC',    avg: 540 },
  { name: 'Linda Kwon',        email: 'linda.k@gmail.com',    usual_location: 'Calgary, AB',     avg: 210 },
  { name: 'David Osei',        email: 'd.osei@hotmail.com',   usual_location: 'Ottawa, ON',      avg: 430 },
  { name: 'Maria Fernandez',   email: 'm.fernandez@yahoo.ca', usual_location: 'Edmonton, AB',    avg: 290 },
  { name: 'Wei Zhang',         email: 'wei.z@email.com',      usual_location: 'Mississauga, ON', avg: 670 },
  { name: 'Sophie Tremblay',   email: 's.tremblay@web.ca',    usual_location: 'Quebec City, QC', avg: 150 },
  { name: 'Olu Adeyemi',       email: 'o.adeyemi@mail.ca',    usual_location: 'Winnipeg, MB',    avg: 380 },
  { name: 'Fatima Al-Hassan',  email: 'f.alhassan@inbox.ca',  usual_location: 'Brampton, ON',    avg: 260 },
  { name: 'Daniel Park',       email: 'd.park@connect.ca',    usual_location: 'Burnaby, BC',     avg: 890 },
  { name: 'Emma Blackwood',    email: 'e.blackwood@net.ca',   usual_location: 'Halifax, NS',     avg: 195 },
];

const insertCustomer = db.prepare('INSERT INTO customers (name, email, usual_location, average_transaction_amount) VALUES (?, ?, ?, ?)');
const customerIds: SeedCustomer[] = [];
for (const c of customers) {
  const r = insertCustomer.run(c.name, c.email, c.usual_location, c.avg);
  customerIds.push({ id: Number(r.lastInsertRowid), ...c });
}
console.log('✓ Customers seeded');

// ─── Accounts ─────────────────────────────────────────────────────────────────
const insertAccount = db.prepare('INSERT INTO accounts (customer_id, account_number, account_type, balance) VALUES (?, ?, ?, ?)');
const accountIds: Record<number, number> = {};
const accountTypes = ['chequing', 'savings', 'credit', 'business'];
let accNum = 1000000000;
customerIds.forEach((c, i) => {
  const type = accountTypes[i % accountTypes.length];
  const r = insertAccount.run(c.id, String(accNum++), type, Math.round(rand() * 20000 + 500));
  accountIds[c.id] = Number(r.lastInsertRowid);
});
console.log('✓ Accounts seeded');

// ─── Transactions ─────────────────────────────────────────────────────────────
const MERCHANTS = {
  shopify:    { name: 'Shopify Store',       category: 'e-commerce' },
  loblaws:    { name: 'Loblaws',             category: 'groceries' },
  atm:        { name: 'TD ATM Withdrawal',   category: 'cash_withdrawal' },
  amazon:     { name: 'Amazon.ca',           category: 'e-commerce' },
  timHortons: { name: 'Tim Hortons',         category: 'food_beverage' },
  petro:      { name: 'Petro-Canada',        category: 'fuel' },
  bell:       { name: 'Bell Canada',         category: 'utilities' },
  netflix:    { name: 'Netflix CA',          category: 'subscription' },
  airCanada:  { name: 'Air Canada',          category: 'travel' },
  westjet:    { name: 'WestJet',             category: 'travel' },
  bitcoin:    { name: 'Bitcoin Exchange',    category: 'crypto' },
  wire:       { name: 'Wire Transfer Co',    category: 'wire_transfer' },
  casino:     { name: 'Casino Royale',       category: 'gambling' },
  bestBuy:    { name: 'Best Buy Canada',     category: 'electronics' },
  ikea:       { name: 'IKEA Canada',         category: 'home_goods' },
  shoppers:   { name: 'Shoppers Drug Mart',  category: 'pharmacy' },
  sobeys:     { name: 'Sobeys',              category: 'groceries' },
  cineplex:   { name: 'Cineplex',            category: 'entertainment' },
  uberEats:   { name: 'Uber Eats',           category: 'food_beverage' },
  steam:      { name: 'Steam Games',         category: 'gaming' },
  moneyOrder: { name: 'Money Order Service', category: 'money_order' },
  fx:         { name: 'FX Trading Ltd',      category: 'wire_transfer' },
};

type MerchantKey = keyof typeof MERCHANTS;

const EVERYDAY: MerchantKey[] = ['shopify', 'loblaws', 'atm', 'amazon', 'timHortons', 'petro', 'bell', 'netflix', 'sobeys', 'shoppers'];

// Timestamps are whole days in the past (UTC), so nothing is ever future-dated.
function at(daysAgo: number, hourUTC: number, minute = 0): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hourUTC, minute, 0, 0);
  return d.toISOString();
}

interface Scenario {
  cust: number;
  merch: MerchantKey;
  loc?: string;
  mult?: number;
  amount?: number;
  daysAgo: number;
  hour: number;
  minute?: number;
  type?: TransactionType;
  expect: RiskLevel;
  key?: string;
}

interface SeedTransaction {
  id?: number;
  cust: SeedCustomer;
  merchant: { name: string; category: string };
  loc: string;
  amount: number;
  time: string;
  type: TransactionType;
  expect: RiskLevel;
  key?: string;
}

const txSeed: SeedTransaction[] = [];

// `mult` is a multiple of the customer's average spend; `amount` is absolute.
// `loc` defaults to the customer's usual location. `expect` documents the risk
// level the scenario is designed to land in and is verified after scoring.
function scenario({ cust: custIdx, merch, loc, mult = 1, amount, daysAgo, hour, minute = 0, type, expect, key }: Scenario): void {
  const cust = customerIds[custIdx];
  const merchant = MERCHANTS[merch];
  txSeed.push({
    cust,
    merchant,
    loc: loc || cust.usual_location,
    amount: amount ?? Math.round(cust.avg * mult * 100) / 100,
    time: at(daysAgo, hour, minute),
    type: type || (merch === 'atm' ? 'withdrawal' : 'purchase'),
    expect,
    key,
  });
}

// Normal activity: usual location, typical amount, daytime, everyday merchants.
for (let i = 0; i < 36; i++) {
  const custIdx = i % customerIds.length;
  scenario({
    cust: custIdx,
    merch: EVERYDAY[i % EVERYDAY.length],
    mult: 0.5 + rand(),
    daysAgo: 1 + Math.floor(rand() * 14),
    hour: 9 + (i % 10),
    minute: Math.floor(rand() * 60),
    expect: 'low',
  });
}

// One weak signal on its own stays below the review threshold.
scenario({ cust: 0, merch: 'westjet',  loc: 'Calgary, AB', mult: 2.5, daysAgo: 9,  hour: 22, minute: 15, expect: 'low' }); // new location
scenario({ cust: 2, merch: 'cineplex', loc: 'Ottawa, ON',  mult: 2.2, daysAgo: 6,  hour: 10, minute: 15, expect: 'low' }); // new location
scenario({ cust: 5, merch: 'netflix',                      mult: 1.0, daysAgo: 11, hour: 3,  minute: 40, expect: 'low' }); // unusual hour
scenario({ cust: 7, merch: 'amazon',                       mult: 3.2, daysAgo: 4,  hour: 11, minute: 15, expect: 'low' }); // 3x amount

// Medium: two signals combine.
scenario({ cust: 1,  merch: 'ikea',      loc: 'Toronto, ON',   mult: 3.0, daysAgo: 2,  hour: 8,  minute: 15, expect: 'medium' }); // amount + new location
scenario({ cust: 3,  merch: 'bestBuy',   loc: 'Edmonton, AB',  mult: 3.4, daysAgo: 12, hour: 20, minute: 15, expect: 'medium' }); // amount + new location
scenario({ cust: 4,  merch: 'westjet',   loc: 'Vancouver, BC', mult: 2.5, daysAgo: 5,  hour: 2,  minute: 15, expect: 'medium' }); // new location + hour
scenario({ cust: 6,  merch: 'casino',                          mult: 1.2, daysAgo: 8,  hour: 1,  minute: 5,  expect: 'medium' }); // category + hour
scenario({ cust: 8,  merch: 'bitcoin',                         mult: 3.5, daysAgo: 10, hour: 15, minute: 30, expect: 'medium' }); // amount + category
scenario({ cust: 9,  merch: 'airCanada', loc: 'New York, USA', mult: 1.5, daysAgo: 13, hour: 16, minute: 45, expect: 'medium' }); // travel abroad
scenario({ cust: 10, merch: 'bestBuy',                         mult: 5.2, daysAgo: 7,  hour: 13, minute: 20, expect: 'medium' }); // 5x amount
scenario({ cust: 11, merch: 'steam',                           mult: 3.1, daysAgo: 9,  hour: 4,  minute: 10, expect: 'medium' }); // amount + hour
scenario({ cust: 2,  merch: 'shopify',   loc: 'London, UK',    mult: 1.1, daysAgo: 1,  hour: 12, minute: 5,  expect: 'medium' }); // travel abroad

// High: three signals, or a very large amount plus another signal.
scenario({ cust: 0,  merch: 'wire',       loc: 'Miami, USA',          mult: 1.4, daysAgo: 4,  hour: 14, minute: 10, type: 'international', expect: 'high' });
scenario({ cust: 3,  merch: 'bestBuy',    loc: 'Vancouver, BC',       mult: 5.5, daysAgo: 3,  hour: 19, minute: 25, expect: 'high' });
scenario({ cust: 5,  merch: 'airCanada',  loc: 'Mexico City, Mexico', mult: 1.2, daysAgo: 6,  hour: 3,  minute: 50, expect: 'high' });
scenario({ cust: 6,  merch: 'ikea',       loc: 'Montreal, QC',        mult: 3.3, daysAgo: 12, hour: 2,  minute: 35, expect: 'high' });
scenario({ cust: 8,  merch: 'shopify',    loc: 'Frankfurt, Germany',  mult: 3.2, daysAgo: 2,  hour: 11, minute: 0,  expect: 'high' });
scenario({ cust: 9,  merch: 'bitcoin',                                mult: 5.5, daysAgo: 5,  hour: 1,  minute: 20, expect: 'high', key: 'crypto-late-night' });
scenario({ cust: 1,  merch: 'casino',     loc: 'Calgary, AB',         mult: 3.5, daysAgo: 8,  hour: 21, minute: 40, expect: 'high' });
scenario({ cust: 4,  merch: 'moneyOrder', loc: 'Singapore',           mult: 1.0, daysAgo: 10, hour: 10, minute: 30, type: 'international', expect: 'high' });
scenario({ cust: 10, merch: 'atm',        amount: 5000,                          daysAgo: 13, hour: 14, minute: 0,  expect: 'high' }); // large round cash withdrawal at home

// Critical: international, off-hours, high-risk merchant and a large amount together.
scenario({ cust: 0, merch: 'bitcoin',    loc: 'New York, USA',       mult: 6.0, daysAgo: 1, hour: 2, minute: 30, expect: 'critical', key: 'crypto-new-york' });
scenario({ cust: 1, merch: 'wire',       loc: 'Lagos, Nigeria',      mult: 5.5, daysAgo: 6, hour: 3, minute: 30, type: 'international', expect: 'critical', key: 'wire-lagos' });
scenario({ cust: 2, merch: 'casino',     loc: 'Miami, USA',          mult: 4.5, daysAgo: 3, hour: 1, minute: 30, expect: 'critical' });
scenario({ cust: 3, merch: 'moneyOrder', loc: 'Dubai, UAE',          mult: 7.0, daysAgo: 2, hour: 4, minute: 30, type: 'international', expect: 'critical', key: 'money-order-dubai' });
scenario({ cust: 4, merch: 'bitcoin',    loc: 'Singapore',           mult: 5.0, daysAgo: 7, hour: 2, minute: 30, expect: 'critical' });
scenario({ cust: 5, merch: 'fx',         loc: 'Frankfurt, Germany',  mult: 6.5, daysAgo: 9, hour: 3, minute: 30, type: 'international', expect: 'critical', key: 'fx-frankfurt' });
scenario({ cust: 6, merch: 'atm',        loc: 'London, UK',          mult: 8.0, daysAgo: 4, hour: 4, minute: 30, expect: 'critical', key: 'atm-london' });
scenario({ cust: 7, merch: 'wire',       loc: 'Mexico City, Mexico', mult: 5.5, daysAgo: 5, hour: 1, minute: 30, type: 'international', expect: 'critical' });

// Structuring: large round-number cash withdrawals in the middle of the night.
scenario({ cust: 0, merch: 'atm', loc: 'Toronto, ON', amount: 5000,  daysAgo: 11, hour: 2, expect: 'critical' });
scenario({ cust: 1, merch: 'atm', loc: 'Toronto, ON', amount: 9000,  daysAgo: 10, hour: 2, expect: 'critical', key: 'structuring-9000' });
scenario({ cust: 2, merch: 'atm', loc: 'Toronto, ON', amount: 7500,  daysAgo: 8,  hour: 2, expect: 'critical' });
scenario({ cust: 3, merch: 'atm', loc: 'Toronto, ON', amount: 10000, daysAgo: 14, hour: 2, expect: 'critical' });

// Card testing: a burst of small online purchases from a new city, then a
// large one. The velocity signal fires from the fourth transaction onward.
const burst: Pick<Scenario, 'cust' | 'loc' | 'daysAgo' | 'hour' | 'type'> = { cust: 11, loc: 'Toronto, ON', daysAgo: 3, hour: 18, type: 'online_purchase' };
scenario({ ...burst, merch: 'shopify',  amount: 24.99,   minute: 2,  expect: 'low' });
scenario({ ...burst, merch: 'amazon',   amount: 39.5,    minute: 9,  expect: 'low' });
scenario({ ...burst, merch: 'steam',    amount: 59.99,   minute: 15, expect: 'low' });
scenario({ ...burst, merch: 'uberEats', amount: 44.1,    minute: 21, expect: 'medium' });
scenario({ ...burst, merch: 'bestBuy',  amount: 310,     minute: 26, expect: 'medium' });
scenario({ ...burst, merch: 'bestBuy',  amount: 1249,    minute: 34, expect: 'critical', key: 'card-testing' });

// Insert everything first, then score: the velocity signal depends on the
// customer's other transactions already being in the database.
const insertTx = db.prepare(`
  INSERT INTO transactions (customer_id, account_id, amount, merchant, category, location, transaction_type, transaction_time)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const txIdByKey: Record<string, number> = {};
const levelCounts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
const mismatches: string[] = [];

db.transaction(() => {
  for (const tx of txSeed) {
    tx.id = Number(insertTx.run(
      tx.cust.id, accountIds[tx.cust.id],
      tx.amount, tx.merchant.name, tx.merchant.category, tx.loc, tx.type, tx.time
    ).lastInsertRowid);
    if (tx.key) txIdByKey[tx.key] = tx.id;
  }
  for (const tx of txSeed) {
    const result = tx.id === undefined ? null : assessTransaction(tx.id);
    if (!result) throw new Error(`Seed transaction for ${tx.merchant.name} was not inserted`);
    levelCounts[result.riskLevel]++;
    if (result.riskLevel !== tx.expect) {
      mismatches.push(`#${tx.id} ${tx.merchant.name} (${tx.loc}): expected ${tx.expect}, scored ${result.score} (${result.riskLevel})`);
    }
  }
})();

if (mismatches.length > 0) {
  throw new Error(`Seed scenarios no longer match the risk engine:\n  ${mismatches.join('\n  ')}`);
}
console.log(`✓ ${txSeed.length} transactions seeded`, levelCounts);

// ─── Fraud Cases ──────────────────────────────────────────────────────────────
const analystIds = [userIds['analyst@finguard.ca'], userIds['marcus.w@finguard.ca'], userIds['priya.s@finguard.ca']];

interface CaseSeed {
  tx: string;
  status: CaseStatus;
  priority: CasePriority;
  analystIdx: number | null;
  resolution?: string;
}

const caseSeeds: CaseSeed[] = [
  { tx: 'crypto-new-york',   status: 'Under Review',   priority: 'Critical', analystIdx: 0 },
  { tx: 'money-order-dubai', status: 'Escalated',      priority: 'Critical', analystIdx: 1 },
  { tx: 'crypto-late-night', status: 'New',            priority: 'High',     analystIdx: null },
  { tx: 'atm-london',        status: 'Under Review',   priority: 'Critical', analystIdx: 2 },
  { tx: 'wire-lagos',        status: 'Resolved',       priority: 'High',     analystIdx: 0, resolution: 'Confirmed fraudulent wire transfer. Customer contacted and account secured.' },
  { tx: 'fx-frankfurt',      status: 'False Positive', priority: 'Medium',   analystIdx: 1, resolution: 'Customer confirmed travel to Germany and initiated the transfer themselves.' },
  { tx: 'card-testing',      status: 'New',            priority: 'Critical', analystIdx: null },
  { tx: 'structuring-9000',  status: 'Under Review',   priority: 'High',     analystIdx: 2 },
];

const insertCase = db.prepare(`
  INSERT INTO fraud_cases (transaction_id, assigned_to, status, priority, resolution)
  VALUES (?, ?, ?, ?, ?)
`);

const insertNote = db.prepare('INSERT INTO case_notes (case_id, user_id, note) VALUES (?, ?, ?)');

const caseIds: number[] = [];
for (const cs of caseSeeds) {
  const analystId = cs.analystIdx !== null ? analystIds[cs.analystIdx] : null;
  const r = insertCase.run(txIdByKey[cs.tx], analystId, cs.status, cs.priority, cs.resolution || null);
  caseIds.push(Number(r.lastInsertRowid));
}

// Add notes to cases
const noteTemplates = [
  'Initial review completed. Transaction flagged for international location and amount anomaly.',
  'Contacted customer via phone. No response. Placed account on temporary hold pending verification.',
  'Customer confirmed they did not initiate this transaction. Escalating to senior analyst.',
  'Merchant confirmed the charge. Running additional verification on account.',
  'Pattern matches known structuring scheme — filing SAR report.',
  'Second review complete. Recommending resolution as confirmed fraud.',
  'Transaction occurred during customer travel period — needs location verification.',
  'IP geolocation mismatch detected between login and transaction origin.',
];

for (let i = 0; i < Math.min(caseIds.length, 5); i++) {
  const note1 = noteTemplates[i * 2 % noteTemplates.length];
  const note2 = noteTemplates[(i * 2 + 1) % noteTemplates.length];
  // The first note comes from whoever is working the case.
  const assigned = caseSeeds[i].analystIdx;
  insertNote.run(caseIds[i], analystIds[assigned ?? i % 3], note1);
  if (i < 3) insertNote.run(caseIds[i], userIds['admin@finguard.ca'], note2);
}

console.log(`✓ ${caseIds.length} fraud cases seeded`);

// ─── Audit Logs ───────────────────────────────────────────────────────────────
const insertAudit = db.prepare(`
  INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, old_value, new_value)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

interface AuditSeed {
  uid: number;
  name: string;
  action: string;
  et: string;
  eid: number;
  ov?: Record<string, unknown>;
  nv?: Record<string, unknown>;
}

const auditSeeds: AuditSeed[] = [
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'USER_LOGIN', et: 'user', eid: userIds['admin@finguard.ca'] },
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'USER_REGISTERED', et: 'user', eid: userIds['priya.s@finguard.ca'], nv: { role: 'analyst' } },
  { uid: userIds['analyst@finguard.ca'], name: 'Analyst User', action: 'USER_LOGIN', et: 'user', eid: userIds['analyst@finguard.ca'] },
  { uid: userIds['analyst@finguard.ca'], name: 'Analyst User', action: 'TRANSACTION_VIEWED', et: 'transaction', eid: txIdByKey['crypto-new-york'] },
  { uid: userIds['analyst@finguard.ca'], name: 'Analyst User', action: 'FRAUD_CASE_CREATED', et: 'fraud_case', eid: caseIds[0] },
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'CASE_ASSIGNED', et: 'fraud_case', eid: caseIds[0], nv: { analyst: 'Analyst User' } },
  { uid: userIds['analyst@finguard.ca'], name: 'Analyst User', action: 'NOTE_ADDED', et: 'fraud_case', eid: caseIds[0] },
  { uid: userIds['marcus.w@finguard.ca'], name: 'Marcus Williams', action: 'USER_LOGIN', et: 'user', eid: userIds['marcus.w@finguard.ca'] },
  { uid: userIds['marcus.w@finguard.ca'], name: 'Marcus Williams', action: 'CASE_STATUS_CHANGED', et: 'fraud_case', eid: caseIds[1], ov: { status: 'New' }, nv: { status: 'Escalated' } },
  { uid: userIds['priya.s@finguard.ca'], name: 'Priya Sharma', action: 'FRAUD_CASE_CREATED', et: 'fraud_case', eid: caseIds[3] },
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'CASE_ASSIGNED', et: 'fraud_case', eid: caseIds[3], nv: { analyst: 'Priya Sharma' } },
  { uid: userIds['priya.s@finguard.ca'], name: 'Priya Sharma', action: 'NOTE_ADDED', et: 'fraud_case', eid: caseIds[3] },
  { uid: userIds['analyst@finguard.ca'], name: 'Analyst User', action: 'CASE_STATUS_CHANGED', et: 'fraud_case', eid: caseIds[4], ov: { status: 'Under Review' }, nv: { status: 'Resolved' } },
  { uid: userIds['marcus.w@finguard.ca'], name: 'Marcus Williams', action: 'CASE_STATUS_CHANGED', et: 'fraud_case', eid: caseIds[5], ov: { status: 'Under Review' }, nv: { status: 'False Positive' } },
  { uid: userIds['analyst@finguard.ca'], name: 'Analyst User', action: 'USER_LOGIN', et: 'user', eid: userIds['analyst@finguard.ca'] },
];

for (const log of auditSeeds) {
  insertAudit.run(
    log.uid, log.name, log.action, log.et, log.eid || null,
    log.ov ? JSON.stringify(log.ov) : null,
    log.nv ? JSON.stringify(log.nv) : null
  );
}

console.log(`✓ ${auditSeeds.length} audit logs seeded`);
console.log('\n✅ Database seeded successfully!');
console.log('\nDemo credentials:');
console.log('  Admin:   admin@finguard.ca   / Admin@1234');
console.log('  Analyst: analyst@finguard.ca / Analyst@1234');
