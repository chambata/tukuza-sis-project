const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { BACKUP_DIR, listBackups, runBackup } = require('../lib/backup');

const router = express.Router();
router.use(requireAuth, requireRole('Administrator'));

router.get('/', (req, res) => {
  res.json(listBackups());
});

router.post('/', async (req, res) => {
  try {
    const filename = await runBackup();
    logAction(req, 'BACKUP', 'database', null, { filename });
    res.status(201).json({ filename });
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

module.exports = router;
