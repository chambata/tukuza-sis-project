const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// Allow overriding the DB location (Electron passes userData path in production)
const DB_DIR = process.env.SIMS_DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'sims.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed a default administrator account on first run so the app is usable
// immediately after install. The password should be changed after first login.
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('Admin@2026', 10);
  db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`
  ).run('admin', hash, 'System Administrator', 'Administrator');
  console.log('[db] Seeded default admin user -> username: admin / password: Admin@2026 (change this after first login)');
}

module.exports = db;
module.exports.DB_PATH = DB_PATH;
