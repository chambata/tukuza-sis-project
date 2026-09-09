const { SYSTEM_ADMIN_ROLES } = require('../lib/roles');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { BACKUP_DIR, listBackups, runBackup, getSecondaryFolder, setSecondaryFolder, mirrorAllToSecondary } = require('../lib/backup');

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

module.exports = router;
