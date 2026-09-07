const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(requireAuth, requireRole('Administrator'));

const BACKUP_DIR = path.join(path.dirname(db.DB_PATH), 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

router.get('/', (req, res) => {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: stat.size, created_at: stat.mtime };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(files);
});

router.post('/', (req, res) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sims-backup-${stamp}.db`;
  const dest = path.join(BACKUP_DIR, filename);
  // better-sqlite3's built-in online backup API — safe to run while the app is in use.
  db.backup(dest)
    .then(() => {
      logAction(req, 'BACKUP', 'database', null, { filename });
      res.status(201).json({ filename });
    })
    .catch((err) => {
      console.error('[backup] failed', err);
      res.status(500).json({ error: 'Backup failed' });
    });
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
