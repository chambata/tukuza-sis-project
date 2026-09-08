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

// --- Migrations for databases created before these columns/tables existed ---
// SQLite has no "ADD COLUMN IF NOT EXISTS", so check PRAGMA table_info first.
// CREATE TABLE IF NOT EXISTS in schema.sql already handles brand-new tables
// (programmes, academic_years) on existing databases; only new columns on
// pre-existing tables need explicit handling here.
function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}
function addColumnIfMissing(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] Migrated: added ${table}.${column}`);
  }
}
addColumnIfMissing('users', 'assigned_program', 'TEXT');
addColumnIfMissing('results', 'type', "TEXT NOT NULL DEFAULT 'Exam'");
addColumnIfMissing('results', 'status', "TEXT NOT NULL DEFAULT 'Draft'");
addColumnIfMissing('results', 'approved_by', 'TEXT');
addColumnIfMissing('results', 'approved_at', 'TEXT');

// Backfill the programmes table from whatever distinct program names already
// exist on student records, so the dropdown isn't empty after upgrading.
const programmeCount = db.prepare('SELECT COUNT(*) AS c FROM programmes').get().c;
if (programmeCount === 0) {
  const existingPrograms = db.prepare(
    "SELECT DISTINCT program FROM students WHERE program IS NOT NULL AND TRIM(program) != ''"
  ).all();
  const insertProgramme = db.prepare('INSERT OR IGNORE INTO programmes (name) VALUES (?)');
  const txn = db.transaction((rows) => {
    for (const row of rows) insertProgramme.run(row.program);
  });
  txn(existingPrograms);
  if (existingPrograms.length) {
    console.log(`[db] Backfilled ${existingPrograms.length} programme(s) from existing student records`);
  }
}

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
