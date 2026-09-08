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

module.exports = {
  BACKUP_DIR, listBackups, runBackup, backupIfStale,
  getSecondaryFolder, setSecondaryFolder, mirrorAllToSecondary,
};
