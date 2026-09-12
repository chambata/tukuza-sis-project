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

function getSecondaryFolder() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'secondary_backup_folder'").get();
  return row ? row.value : null;
}

function setSecondaryFolder(folderPath) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('secondary_backup_folder', folderPath);
}

/**
 * Copies a backup file to the configured secondary folder (e.g. a synced
 * OneDrive/Google Drive/Dropbox folder the user picked), if one is set.
 * Never throws — a missing/unreachable secondary folder (drive unplugged,
 * folder deleted, etc.) should never break the primary local backup.
 */
function mirrorToSecondary(filename) {
  const folder = getSecondaryFolder();
  if (!folder) return { copied: false };
  try {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    fs.copyFileSync(path.join(BACKUP_DIR, filename), path.join(folder, filename));
    return { copied: true };
  } catch (err) {
    console.error(`[backup] Failed to mirror ${filename} to secondary folder (${folder}):`, err.message);
    return { copied: false, error: err.message };
  }
}

async function runBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sims-backup-${stamp}.db`;
  const dest = path.join(BACKUP_DIR, filename);
  await db.backup(dest);
  const mirror = mirrorToSecondary(filename);
  return { filename, mirrored: mirror.copied, mirrorError: mirror.error || null };
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
  const result = await runBackup();
  console.log(`[backup] Automatic daily backup created: ${result.filename}`);
  return result;
}

/** Copies every existing local backup to the secondary folder (catch-up sync). */
function mirrorAllToSecondary() {
  const folder = getSecondaryFolder();
  if (!folder) return { copied: 0, error: 'No secondary folder is configured' };
  let copied = 0;
  for (const b of listBackups()) {
    const result = mirrorToSecondary(b.filename);
    if (result.copied) copied++;
  }
  return { copied };
}

/**
 * Sanity-checks that a file is actually a Tukuza SIS database before we
 * consider restoring from it — opened as a completely separate, read-only
 * connection so it never touches the live `db` handle.
 */
function validateBackupFile(filePath) {
  const Database = require('better-sqlite3');
  let testDb;
  try {
    testDb = new Database(filePath, { readonly: true, fileMustExist: true });
    const table = testDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='students'"
    ).get();
    if (!table) return { valid: false, error: 'This file does not look like a Tukuza SIS backup (no students table found).' };
    const cols = testDb.prepare('PRAGMA table_info(students)').all().map((c) => c.name);
    if (!cols.includes('student_id') || !cols.includes('first_name')) {
      return { valid: false, error: 'This file does not look like a Tukuza SIS backup (unexpected students table shape).' };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `This file could not be opened as a database (${err.message}).` };
  } finally {
    if (testDb) testDb.close();
  }
}

/**
 * Restores the live database from a backup file. This closes the live `db`
 * connection and overwrites its file on disk — on Windows especially, a
 * file with an open handle generally can't be overwritten, so the
 * connection must be closed first. Because closing it means no further
 * request can be served, the caller must send its HTTP response *before*
 * calling this, and the app must then restart (see restartApp below) so a
 * fresh process reopens a fresh connection to the restored file.
 */
function restoreFromFile(sourceFilePath) {
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  fs.copyFileSync(sourceFilePath, db.DB_PATH);
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = db.DB_PATH + suffix;
    if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
  }
}

/**
 * Restarts the whole app so a fresh process picks up the restored database
 * cleanly. Only works inside Electron (the real deployment target); falls
 * back to a plain process exit in dev/standalone-node contexts, where
 * whoever started the process is expected to restart it manually.
 */
function restartApp() {
  try {
    const { app } = require('electron');
    app.relaunch();
    app.exit(0);
  } catch (err) {
    console.log('[backup] Not running under Electron — exiting so the process can be restarted manually.');
    process.exit(0);
  }
}

module.exports = {
  BACKUP_DIR, listBackups, runBackup, backupIfStale,
  getSecondaryFolder, setSecondaryFolder, mirrorAllToSecondary,
  validateBackupFile, restoreFromFile, restartApp,
};
