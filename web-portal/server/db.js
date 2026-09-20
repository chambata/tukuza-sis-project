const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const DB_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'portal.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Generate a sync API key on first run if one hasn't been set via the
// SYNC_API_KEY environment variable — printed once so it can be copied into
// the desktop app's Settings > Website Sync page.
const hasKey = db.prepare("SELECT value FROM settings WHERE key = 'sync_api_key'").get();
if (!hasKey) {
  const key = process.env.SYNC_API_KEY || crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('sync_api_key', key);
  console.log('==================================================================');
  console.log('[portal] Generated sync API key (copy this into the desktop app,');
  console.log('[portal] Settings > Website Sync):');
  console.log(`[portal]   ${key}`);
  console.log('==================================================================');
}

module.exports = db;
module.exports.DB_PATH = DB_PATH;
