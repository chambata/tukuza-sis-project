const fs = require('fs');
const path = require('path');
const db = require('../db');

const BACKUP_DIR = path.join(path.dirname(db.DB_PATH), 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function listBackups() {
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: stat.size, created_at: stat.mtime };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function runBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sims-backup-${stamp}.db`;
  const dest = path.join(BACKUP_DIR, filename);
  await db.backup(dest);
  return filename;
}

/**
 * Runs a backup once, but only if the most recent existing backup is older
 * than `maxAgeHours` (default 24h). Safe to call every time the app starts.
 */
async function backupIfStale(maxAgeHours = 24) {
  const backups = listBackups();
  const newest = backups[0];
  const staleMs = maxAgeHours * 60 * 60 * 1000;
  if (newest && Date.now() - new Date(newest.created_at).getTime() < staleMs) {
    return null; // recent backup already exists, nothing to do
  }
  const filename = await runBackup();
  console.log(`[backup] Automatic daily backup created: ${filename}`);
  return filename;
}

module.exports = { BACKUP_DIR, listBackups, runBackup, backupIfStale };
