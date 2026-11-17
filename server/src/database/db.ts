import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');

// Tests run against a throwaway in-memory database so they never read or
// modify the development data. DB_PATH can override the location explicitly.
const DB_PATH = process.env.DB_PATH
  || (process.env.NODE_ENV === 'test' ? ':memory:' : path.join(DB_DIR, 'finguard.db'));

if (DB_PATH !== ':memory:') {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
