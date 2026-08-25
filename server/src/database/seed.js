require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const db = require('./db');
const { initializeSchema } = require('./schema');
const { calculateRiskScore } = require('../services/riskScoringService');
const { generateTransactionExplanation } = require('../services/aiExplanationService');

initializeSchema();

// Clear existing data
db.exec(`
  DELETE FROM audit_logs;
  DELETE FROM case_notes;
  DELETE FROM fraud_cases;
  DELETE FROM transactions;
  DELETE FROM accounts;
  DELETE FROM customers;
  DELETE FROM users;
`);

// ─── Users ───────────────────────────────────────────────────────────────────
const users = [
  { name: 'Admin User', email: 'admin@finguard.ca', password: 'Admin@1234', role: 'admin' },
  { name: 'Sarah Chen', email: 'sarah.chen@finguard.ca', password: 'Analyst@1234', role: 'analyst' },
  { name: 'Marcus Williams', email: 'marcus.w@finguard.ca', password: 'Analyst@1234', role: 'analyst' },
  { name: 'Priya Sharma', email: 'priya.s@finguard.ca', password: 'Analyst@1234', role: 'analyst' },
];

const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
const userIds = {};
for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  const r = insertUser.run(u.name, u.email, hash, u.role);
  userIds[u.email] = r.lastInsertRowid;
}
console.log('✓ Users seeded');

// ─── Customers ───────────────────────────────────────────────────────────────
const customers = [
  { name: 'James Thornton',    email: 'j.thornton@email.ca',  usual_location: 'Toronto, ON',   avg: 320 },
  { name: 'Aisha Patel',       email: 'aisha.p@webmail.ca',   usual_location: 'Vancouver, BC', avg: 185 },
  { name: 'Robert Dubois',     email: 'r.dubois@outlook.ca',  usual_location: 'Montreal, QC',  avg: 540 },
  { name: 'Linda Kwon',        email: 'linda.k@gmail.com',    usual_location: 'Calgary, AB',   avg: 210 },
  { name: 'David Osei',        email: 'd.osei@hotmail.com',   usual_location: 'Ottawa, ON',    avg: 430 },
  { name: 'Maria Fernandez',   email: 'm.fernandez@yahoo.ca', usual_location: 'Edmonton, AB',  avg: 290 },
  { name: 'Wei Zhang',         email: 'wei.z@email.com',      usual_location: 'Mississauga, ON', avg: 670 },
  { name: 'Sophie Tremblay',   email: 's.tremblay@web.ca',    usual_location: 'Quebec City, QC', avg: 150 },
  { name: 'Olu Adeyemi',       email: 'o.adeyemi@mail.ca',    usual_location: 'Winnipeg, MB',  avg: 380 },
  { name: 'Fatima Al-Hassan',  email: 'f.alhassan@inbox.ca',  usual_location: 'Brampton, ON',  avg: 260 },
  { name: 'Daniel Park',       email: 'd.park@connect.ca',    usual_location: 'Burnaby, BC',   avg: 890 },
  { name: 'Emma Blackwood',    email: 'e.blackwood@net.ca',   usual_location: 'Halifax, NS',   avg: 195 },
];

const insertCustomer = db.prepare('INSERT INTO customers (name, email, usual_location, average_transaction_amount) VALUES (?, ?, ?, ?)');
const customerIds = [];
for (const c of customers) {
  const r = insertCustomer.run(c.name, c.email, c.usual_location, c.avg);
  customerIds.push({ id: r.lastInsertRowid, ...c });
}
console.log('✓ Customers seeded');

// ─── Accounts ─────────────────────────────────────────────────────────────────
const insertAccount = db.prepare('INSERT INTO accounts (customer_id, account_number, account_type, balance) VALUES (?, ?, ?, ?)');
const accountIds = {};
const accountTypes = ['chequing', 'savings', 'credit', 'business'];
let accNum = 1000000000;
for (const c of customerIds) {
  const type = accountTypes[customerIds.indexOf(c) % accountTypes.length];
  const r = insertAccount.run(c.id, String(accNum++), type, Math.round(Math.random() * 20000 + 500));
  accountIds[c.id] = r.lastInsertRowid;
}
console.log('✓ Accounts seeded');

// ─── Transactions ─────────────────────────────────────────────────────────────
const merchants = [
  { name: 'Shopify Store',      category: 'e-commerce' },
  { name: 'Loblaws',            category: 'groceries' },
  { name: 'TD ATM Withdrawal',  category: 'cash_withdrawal' },
  { name: 'Amazon.ca',          category: 'e-commerce' },
  { name: 'Tim Hortons',        category: 'food_beverage' },
  { name: 'Petro-Canada',       category: 'fuel' },
  { name: 'Bell Canada',        category: 'utilities' },
  { name: 'Netflix CA',         category: 'subscription' },
  { name: 'Air Canada',         category: 'travel' },
  { name: 'WestJet',            category: 'travel' },
  { name: 'Bitcoin Exchange',   category: 'crypto' },
  { name: 'Wire Transfer Co',   category: 'wire_transfer' },
  { name: 'Casino Royale',      category: 'gambling' },
  { name: 'Best Buy Canada',    category: 'electronics' },
  { name: 'IKEA Canada',        category: 'home_goods' },
  { name: 'Shoppers Drug Mart', category: 'pharmacy' },
  { name: 'Sobeys',             category: 'groceries' },
  { name: 'Cineplex',           category: 'entertainment' },
  { name: 'Uber Eats',          category: 'food_beverage' },
  { name: 'Steam Games',        category: 'gaming' },
  { name: 'Money Order Service',category: 'money_order' },
  { name: 'FX Trading Ltd',     category: 'wire_transfer' },
];

const locations = [
  'Toronto, ON', 'Vancouver, BC', 'Montreal, QC', 'Calgary, AB', 'Ottawa, ON',
  'Edmonton, AB', 'Mississauga, ON', 'Quebec City, QC', 'Winnipeg, MB', 'Brampton, ON',
  'Burnaby, BC', 'Halifax, NS', 'New York, USA', 'Miami, USA', 'London, UK',
  'Lagos, Nigeria', 'Dubai, UAE', 'Singapore', 'Frankfurt, Germany', 'Mexico City, Mexico',
];

const txTypes = ['purchase', 'withdrawal', 'transfer', 'online_purchase', 'international'];

function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

const insertTx = db.prepare(`
  INSERT INTO transactions (customer_id, account_id, amount, merchant, category, location, transaction_type, transaction_time, risk_score, risk_level, flagged, explanation)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Build a pool of transactions with controlled risk distribution
const txSeed = [];

// Low-risk transactions (normal activity)
for (let i = 0; i < 25; i++) {
  const cust = customerIds[i % customerIds.length];
  const merch = merchants[i % 10]; // non-suspicious merchants
  const loc = cust.usual_location; // usual location
  const amount = Math.round((cust.avg * (0.5 + Math.random() * 1.0)) * 100) / 100;
  const time = randomDate(14);
  const hour = new Date(time).getUTCHours();
  // Keep hours in business hours for low risk
  const safeTime = new Date(time);
  safeTime.setUTCHours(9 + (i % 10));
  txSeed.push({ cust, merch, loc, amount, time: safeTime.toISOString(), type: 'purchase' });
}

// Medium-risk transactions
const mediumSeeds = [
  { custIdx: 0, merch: merchants[8], loc: 'Calgary, AB', amountMult: 2.5, hourOffset: 22 },
  { custIdx: 1, merch: merchants[14], loc: 'Toronto, ON', amountMult: 3.0, hourOffset: 8 },
  { custIdx: 2, merch: merchants[17], loc: 'Ottawa, ON', amountMult: 2.2, hourOffset: 10 },
  { custIdx: 3, merch: merchants[13], loc: 'Edmonton, AB', amountMult: 2.8, hourOffset: 20 },
  { custIdx: 4, merch: merchants[9], loc: 'Vancouver, BC', amountMult: 2.5, hourOffset: 7 },
  { custIdx: 5, merch: merchants[7], loc: 'Montreal, QC', amountMult: 1.8, hourOffset: 23 },
  { custIdx: 6, merch: merchants[15], loc: 'Brampton, ON', amountMult: 2.0, hourOffset: 14 },
  { custIdx: 7, merch: merchants[3], loc: 'Quebec City, QC', amountMult: 3.2, hourOffset: 11 },
];

for (const s of mediumSeeds) {
  const cust = customerIds[s.custIdx];
  const amount = Math.round(cust.avg * s.amountMult * 100) / 100;
  const time = new Date();
  time.setDate(time.getDate() - Math.floor(Math.random() * 10));
  time.setUTCHours(s.hourOffset, 15, 0, 0);
  txSeed.push({ cust, merch: s.merch, loc: s.loc, amount, time: time.toISOString(), type: 'purchase' });
}

// High-risk and critical transactions
const highRiskSeeds = [
  { custIdx: 0, merch: merchants[10], loc: 'New York, USA', amountMult: 6.0, hour: 2 },   // Bitcoin Exchange, international, late night
  { custIdx: 1, merch: merchants[11], loc: 'Lagos, Nigeria', amountMult: 5.5, hour: 3 },   // Wire Transfer, international
  { custIdx: 2, merch: merchants[12], loc: 'Miami, USA', amountMult: 4.5, hour: 1 },       // Casino, international
  { custIdx: 3, merch: merchants[20], loc: 'Dubai, UAE', amountMult: 7.0, hour: 4 },       // Money Order, international
  { custIdx: 4, merch: merchants[10], loc: 'Singapore', amountMult: 5.0, hour: 2 },        // Bitcoin, international
  { custIdx: 5, merch: merchants[21], loc: 'Frankfurt, Germany', amountMult: 6.5, hour: 3 }, // FX Trading
  { custIdx: 6, merch: merchants[2], loc: 'London, UK', amountMult: 8.0, hour: 4 },        // Large ATM withdrawal
  { custIdx: 7, merch: merchants[11], loc: 'Mexico City, Mexico', amountMult: 5.5, hour: 1 },
  { custIdx: 8, merch: merchants[12], loc: 'Miami, USA', amountMult: 4.5, hour: 3 },
  { custIdx: 9, merch: merchants[10], loc: 'New York, USA', amountMult: 6.0, hour: 2 },
  { custIdx: 10, merch: merchants[20], loc: 'Dubai, UAE', amountMult: 7.5, hour: 4 },
  { custIdx: 11, merch: merchants[11], loc: 'Singapore', amountMult: 5.0, hour: 1 },
];

for (const s of highRiskSeeds) {
  const cust = customerIds[s.custIdx];
  const amount = Math.round(cust.avg * s.amountMult * 100) / 100;
  const time = new Date();
  time.setDate(time.getDate() - Math.floor(Math.random() * 7));
  time.setUTCHours(s.hour, 30, 0, 0);
  const txType = s.merch.category === 'wire_transfer' || s.merch.category === 'money_order' ? 'international' : 'purchase';
  txSeed.push({ cust, merch: s.merch, loc: s.loc, amount, time: time.toISOString(), type: txType });
}

// Round number structuring seeds
for (let i = 0; i < 5; i++) {
  const cust = customerIds[i];
  const amount = [5000, 9000, 7500, 10000, 8500][i];
  const time = new Date();
  time.setDate(time.getDate() - i);
  time.setUTCHours(2, 0, 0, 0);
  txSeed.push({ cust, merch: merchants[2], loc: 'Toronto, ON', amount, time: time.toISOString(), type: 'withdrawal' });
}

const txIds = [];
for (const tx of txSeed) {
  const customer = { usual_location: tx.cust.usual_location, average_transaction_amount: tx.cust.avg };
  const txObj = { amount: tx.amount, location: tx.loc, category: tx.merch.category, transaction_time: tx.time, transaction_type: tx.type };
  const result = calculateRiskScore(txObj, customer, []);
  const explanation = generateTransactionExplanation(txObj, result.factors, customer);

  const r = insertTx.run(
    tx.cust.id, accountIds[tx.cust.id],
    tx.amount, tx.merch.name, tx.merch.category, tx.loc, tx.type, tx.time,
    result.score, result.riskLevel, result.flagged ? 1 : 0, explanation
  );
  txIds.push({ id: r.lastInsertRowid, riskLevel: result.riskLevel, flagged: result.flagged });
}
console.log(`✓ ${txSeed.length} transactions seeded`);

// ─── Fraud Cases ──────────────────────────────────────────────────────────────
const analystIds = [userIds['sarah.chen@finguard.ca'], userIds['marcus.w@finguard.ca'], userIds['priya.s@finguard.ca']];
const flaggedTxIds = txIds.filter(t => t.flagged).map(t => t.id);

const caseSeeds = [
  { txIdx: 0, status: 'Under Review', priority: 'Critical', analystIdx: 0 },
  { txIdx: 1, status: 'Escalated', priority: 'Critical', analystIdx: 1 },
  { txIdx: 2, status: 'New', priority: 'High', analystIdx: null },
  { txIdx: 3, status: 'Under Review', priority: 'Critical', analystIdx: 2 },
  { txIdx: 4, status: 'Resolved', priority: 'High', analystIdx: 0, resolution: 'Confirmed fraudulent wire transfer. Customer contacted and account secured.' },
  { txIdx: 5, status: 'False Positive', priority: 'Medium', analystIdx: 1, resolution: 'Customer confirmed travel to Germany and initiated the transfer themselves.' },
  { txIdx: 6, status: 'New', priority: 'Critical', analystIdx: null },
  { txIdx: 7, status: 'Under Review', priority: 'High', analystIdx: 2 },
];

const insertCase = db.prepare(`
  INSERT INTO fraud_cases (transaction_id, assigned_to, status, priority, resolution)
  VALUES (?, ?, ?, ?, ?)
`);

const insertNote = db.prepare('INSERT INTO case_notes (case_id, user_id, note) VALUES (?, ?, ?)');

const caseIds = [];
for (const cs of caseSeeds) {
  if (cs.txIdx >= flaggedTxIds.length) continue;
  const txId = flaggedTxIds[cs.txIdx];
  const analystId = cs.analystIdx !== null ? analystIds[cs.analystIdx] : null;
  const r = insertCase.run(txId, analystId, cs.status, cs.priority, cs.resolution || null);
  caseIds.push(r.lastInsertRowid);
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
  insertNote.run(caseIds[i], analystIds[i % 3], note1);
  if (i < 3) insertNote.run(caseIds[i], userIds['admin@finguard.ca'], note2);
}

console.log(`✓ ${caseIds.length} fraud cases seeded`);

// ─── Audit Logs ───────────────────────────────────────────────────────────────
const insertAudit = db.prepare(`
  INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, old_value, new_value)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const auditSeeds = [
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'USER_LOGIN', et: 'user', eid: userIds['admin@finguard.ca'] },
  { uid: userIds['sarah.chen@finguard.ca'], name: 'Sarah Chen', action: 'USER_LOGIN', et: 'user', eid: userIds['sarah.chen@finguard.ca'] },
  { uid: userIds['sarah.chen@finguard.ca'], name: 'Sarah Chen', action: 'FRAUD_CASE_CREATED', et: 'fraud_case', eid: caseIds[0] },
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'CASE_ASSIGNED', et: 'fraud_case', eid: caseIds[0], nv: { analyst: 'Sarah Chen' } },
  { uid: userIds['sarah.chen@finguard.ca'], name: 'Sarah Chen', action: 'NOTE_ADDED', et: 'fraud_case', eid: caseIds[0] },
  { uid: userIds['marcus.w@finguard.ca'], name: 'Marcus Williams', action: 'CASE_STATUS_CHANGED', et: 'fraud_case', eid: caseIds[1], ov: { status: 'New' }, nv: { status: 'Escalated' } },
  { uid: userIds['priya.s@finguard.ca'], name: 'Priya Sharma', action: 'FRAUD_CASE_CREATED', et: 'fraud_case', eid: caseIds[3] },
  { uid: userIds['sarah.chen@finguard.ca'], name: 'Sarah Chen', action: 'CASE_STATUS_CHANGED', et: 'fraud_case', eid: caseIds[4], ov: { status: 'Under Review' }, nv: { status: 'Resolved' } },
  { uid: userIds['marcus.w@finguard.ca'], name: 'Marcus Williams', action: 'CASE_STATUS_CHANGED', et: 'fraud_case', eid: caseIds[5], ov: { status: 'Under Review' }, nv: { status: 'False Positive' } },
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'TRANSACTION_VIEWED', et: 'transaction', eid: txIds[0]?.id },
  { uid: userIds['priya.s@finguard.ca'], name: 'Priya Sharma', action: 'NOTE_ADDED', et: 'fraud_case', eid: caseIds[3] },
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'CASE_ASSIGNED', et: 'fraud_case', eid: caseIds[3], nv: { analyst: 'Priya Sharma' } },
  { uid: userIds['sarah.chen@finguard.ca'], name: 'Sarah Chen', action: 'USER_LOGIN', et: 'user', eid: userIds['sarah.chen@finguard.ca'] },
  { uid: userIds['marcus.w@finguard.ca'], name: 'Marcus Williams', action: 'USER_LOGIN', et: 'user', eid: userIds['marcus.w@finguard.ca'] },
  { uid: userIds['admin@finguard.ca'], name: 'Admin User', action: 'USER_REGISTERED', et: 'user', eid: userIds['priya.s@finguard.ca'], nv: { role: 'analyst' } },
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
console.log('  Admin:   admin@finguard.ca    / Admin@1234');
console.log('  Analyst: sarah.chen@finguard.ca / Analyst@1234');
