import db from './db';

// ISO-8601 UTC timestamps (e.g. 2026-05-12T14:28:00.123Z). SQLite's
// CURRENT_TIMESTAMP omits the timezone, which browsers then read as local time.
const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

const TABLES = ['audit_logs', 'case_notes', 'fraud_cases', 'transactions', 'accounts', 'customers', 'users'];

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'analyst')),
      created_at DATETIME DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      usual_location TEXT NOT NULL,
      average_transaction_amount REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      account_number TEXT UNIQUE NOT NULL,
      account_type TEXT NOT NULL CHECK(account_type IN ('chequing', 'savings', 'credit', 'business')),
      balance REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT ${NOW},
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('purchase', 'withdrawal', 'transfer', 'deposit', 'online_purchase', 'international')),
      transaction_time DATETIME NOT NULL,
      risk_score INTEGER NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
      flagged INTEGER NOT NULL DEFAULT 0,
      explanation TEXT,
      risk_factors TEXT,
      created_at DATETIME DEFAULT ${NOW},
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS fraud_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL UNIQUE,
      assigned_to INTEGER,
      status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New', 'Under Review', 'Escalated', 'Resolved', 'False Positive')),
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
      summary TEXT,
      resolution TEXT,
      created_at DATETIME DEFAULT ${NOW},
      updated_at DATETIME DEFAULT ${NOW},
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS case_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT ${NOW},
      FOREIGN KEY (case_id) REFERENCES fraud_cases(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT ${NOW}
    );

    -- The audit trail is append-only: the database itself rejects any attempt
    -- to rewrite or remove an entry, regardless of which code path tries.
    CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'audit_logs is append-only: entries cannot be modified');
    END;

    CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'audit_logs is append-only: entries cannot be deleted');
    END;
  `);

  // Databases created before the factor breakdown was stored lack this column.
  const txColumns = (db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[]).map(c => c.name);
  if (!txColumns.includes('risk_factors')) {
    db.exec('ALTER TABLE transactions ADD COLUMN risk_factors TEXT');
  }

  if (process.env.NODE_ENV !== 'test') {
    console.log('Database schema initialized.');
  }
}

/**
 * Drops every table and rebuilds the schema. Used only by the seed script to
 * reset demo data — the audit log cannot be cleared any other way.
 */
function resetSchema() {
  db.pragma('foreign_keys = OFF');
  for (const table of TABLES) {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  db.pragma('foreign_keys = ON');
  initializeSchema();
}

export { initializeSchema, resetSchema };
