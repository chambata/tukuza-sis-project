const { SYSTEM_ADMIN_ROLES } = require('../lib/roles');
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const {
  BACKUP_DIR, listBackups, runBackup, getSecondaryFolder, setSecondaryFolder, mirrorAllToSecondary,
  validateBackupFile, restoreFromFile, restartApp,
} = require('../lib/backup');

const router = express.Router();
router.use(requireAuth, requireRole(...SYSTEM_ADMIN_ROLES));

router.get('/', (req, res) => {
  res.json(listBackups());
});

router.post('/', async (req, res) => {
  try {
    const result = await runBackup();
    logAction(req, 'BACKUP', 'database', null, { filename: result.filename, mirrored: result.mirrored });
    res.status(201).json(result);
  } catch (err) {
    console.error('[backup] failed', err);
    res.status(500).json({ error: 'Backup failed' });
  }
});

router.get('/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
  logAction(req, 'DOWNLOAD', 'database', null, { filename });
  res.download(filePath);
});

router.delete('/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
  fs.unlinkSync(filePath);
  logAction(req, 'DELETE', 'database', null, { filename });
  res.json({ ok: true });
});

router.get('/settings/secondary-folder', (req, res) => {
  res.json({ folder: getSecondaryFolder() });
});

router.put('/settings/secondary-folder', (req, res) => {
  const { folder } = req.body || {};
  setSecondaryFolder(folder || null);
  logAction(req, 'UPDATE', 'settings', null, { secondary_backup_folder: folder });
  res.json({ ok: true });
});

router.post('/settings/secondary-folder/sync-now', (req, res) => {
  const result = mirrorAllToSecondary();
  if (result.error) return res.status(400).json({ error: result.error });
  logAction(req, 'SYNC', 'database', null, { copied: result.copied });
  res.json(result);
});

// --- Restore ---
// Both restore routes follow the same shape: validate -> respond to the
// client -> *then* actually close the DB and swap the file, since closing
// it means no further request (including this one) can be served. The
// small delay gives the HTTP response time to flush before the process
// restarts.
function performRestore(req, res, sourceFilePath, sourceLabel) {
  const validation = validateBackupFile(sourceFilePath);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  logAction(req, 'RESTORE', 'database', null, { source: sourceLabel });
  res.json({ ok: true, message: 'Restoring — the app will restart in a moment.' });

  setTimeout(async () => {
    try {
      await runBackup(); // safety snapshot of current state before we overwrite it
      restoreFromFile(sourceFilePath);
      restartApp();
    } catch (err) {
      console.error('[backup] restore failed', err);
      // Nothing more we can do here — the HTTP response is already sent,
      // and if db.close() already ran, the process needs a restart either way.
      restartApp();
    }
  }, 400);
}

router.post('/:filename/restore', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
  performRestore(req, res, filePath, filename);
});

router.post('/upload-restore', (req, res) => {
  const { filename, data } = req.body || {};
  if (!data) return res.status(400).json({ error: 'No file data received' });
  let buffer;
  try {
    buffer = Buffer.from(data.includes(',') ? data.split(',')[1] : data, 'base64');
  } catch (err) {
    return res.status(400).json({ error: 'Could not decode the uploaded file' });
  }
  const tempPath = path.join(os.tmpdir(), `tukuza-restore-upload-${Date.now()}.db`);
  fs.writeFileSync(tempPath, buffer);
  performRestore(req, res, tempPath, filename || 'uploaded file');
});

module.exports = router;
