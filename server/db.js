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

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}
function addColumnIfMissing(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] Migrated: added ${table}.${column}`);
  }
}

// Extracts just one table's `CREATE TABLE IF NOT EXISTS name (...)` statement
// out of the full schema.sql text, by scanning for balanced parentheses
// (a plain regex can't handle the nested parens in e.g. a CHECK(... IN (...))
// clause).
function extractCreateStatement(schemaText, table) {
  const marker = `CREATE TABLE IF NOT EXISTS ${table} `;
  const start = schemaText.indexOf(marker);
  if (start === -1) throw new Error(`Could not find CREATE TABLE statement for ${table} in schema.sql`);
  const openParen = schemaText.indexOf('(', start);
  let depth = 0;
  let i = openParen;
  for (; i < schemaText.length; i++) {
    if (schemaText[i] === '(') depth++;
    else if (schemaText[i] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  return schemaText.slice(start, i + 1) + ';';
}

// SQLite has no "ALTER TABLE ... ALTER CONSTRAINT", so widening a CHECK
// constraint (e.g. adding new roles or new student statuses) requires
// rebuilding the table. Importantly, this creates the *new* table under a
// temporary name and renames it into place at the end, rather than renaming
// the *old* table out of the way first — because SQLite automatically
// rewrites other tables' REFERENCES clauses to follow a renamed table, which
// would otherwise permanently point e.g. audit_log.user_id at a temporary
// name that gets dropped a moment later. Renaming the replacement *into*
// the real name instead means every other table's REFERENCES text (which
// never changes) simply starts resolving again once a table with that name
// exists — no rewriting, no dangling references.
//
// `transformRow` is an optional function to change values during the copy
// (used once, to upgrade existing 'Administrator' accounts to
// 'Super Administrator' so nobody's access is silently reduced by this
// migration).
function rebuildTableIfCheckOutdated(table, mustContainInCheck, transformRow) {
  const meta = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!meta || meta.sql.includes(mustContainInCheck)) return; // already up to date, or table is brand new

  console.log(`[db] Migrating: rebuilding ${table} to widen its constraints…`);
  const oldColumns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  const tempName = `${table}_new_migration`;

  const createSql = extractCreateStatement(schema, table)
    .replace(`CREATE TABLE IF NOT EXISTS ${table} `, `CREATE TABLE ${tempName} `);

  db.pragma('foreign_keys = OFF');
  const txn = db.transaction(() => {
    db.exec(createSql);
    const insertCols = oldColumns.join(', ');
    const placeholders = oldColumns.map((c) => `@${c}`).join(', ');
    const insert = db.prepare(`INSERT INTO ${tempName} (${insertCols}) VALUES (${placeholders})`);
    for (const row of rows) {
      insert.run(transformRow ? transformRow(row) : row);
    }
    db.exec(`DROP TABLE ${table}`);
    db.exec(`ALTER TABLE ${tempName} RENAME TO ${table}`);
  });
  txn();
  const check = db.prepare('PRAGMA foreign_key_check').all();
  if (check.length > 0) {
    console.error(`[db] WARNING: foreign_key_check found ${check.length} issue(s) after migrating ${table}:`, check);
  }
  db.pragma('foreign_keys = ON');
  console.log(`[db] Migrated: ${table} now has ${rows.length} row(s) under the new schema`);
}

// Widen users.role to the full 7-role set, upgrading any existing
// 'Administrator' account to 'Super Administrator' — the new 'Administrator'
// role is deliberately narrower than the old single admin role, so accounts
// that previously had full access must keep it.
rebuildTableIfCheckOutdated('users', 'Super Administrator', (row) => (
  row.role === 'Administrator' ? { ...row, role: 'Super Administrator' } : row
));

// Widen students.status to include Suspended/Completed.
rebuildTableIfCheckOutdated('students', 'Suspended', (row) => row);

// Widen payments.method to include EFT/Other.
rebuildTableIfCheckOutdated('payments', 'EFT', (row) => row);

// Straightforward new columns on tables whose CHECK constraints didn't change.
addColumnIfMissing('users', 'assigned_program', 'TEXT');
addColumnIfMissing('results', 'type', "TEXT NOT NULL DEFAULT 'Exam'");
addColumnIfMissing('results', 'status', "TEXT NOT NULL DEFAULT 'Draft'");
addColumnIfMissing('results', 'approved_by', 'TEXT');
addColumnIfMissing('results', 'approved_at', 'TEXT');
addColumnIfMissing('departments', 'code', 'TEXT');
addColumnIfMissing('departments', 'head_of_department', 'TEXT');
addColumnIfMissing('departments', 'description', 'TEXT');
addColumnIfMissing('programmes', 'code', 'TEXT');
addColumnIfMissing('programmes', 'department_id', 'INTEGER REFERENCES departments(id)');
addColumnIfMissing('programmes', 'duration_years', 'REAL');
addColumnIfMissing('programmes', 'description', 'TEXT');
addColumnIfMissing('programmes', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('staff', 'position', 'TEXT');
addColumnIfMissing('staff', 'date_employed', 'TEXT');
addColumnIfMissing('payments', 'reference_no', 'TEXT');

// Indexes on columns that only exist after the migrations above have run
// (either via the table rebuilds or addColumnIfMissing) — see the note in
// schema.sql for why these can't live in the unconditional schema exec.
db.exec('CREATE INDEX IF NOT EXISTS idx_students_department ON students(department_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_students_intake ON students(intake_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_programmes_department ON programmes(department_id)');

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

// Seed a default Super Administrator account on first run so the app is
// usable immediately after install. The password should be changed after
// first login.
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('Admin@2026', 10);
  db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`
  ).run('admin', hash, 'System Administrator', 'Super Administrator');
  console.log('[db] Seeded default admin user -> username: admin / password: Admin@2026 (change this after first login)');
}

module.exports = db;
module.exports.DB_PATH = DB_PATH;
