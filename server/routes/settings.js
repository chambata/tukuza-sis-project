const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { getAllSettings } = require('../lib/settings');
const { SYSTEM_ADMIN_ROLES } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth); // any authenticated role can read (currency symbol, institution name, etc.)

// Editable settings only — secondary_backup_folder is managed from the
// Backups page's own dedicated endpoint, not exposed here.
const EDITABLE_KEYS = [
  'institution_name', 'institution_address', 'institution_phone', 'institution_email',
  'institution_logo', 'currency_code', 'currency_symbol',
];

router.get('/', (req, res) => {
  const all = getAllSettings();
  const editable = {};
  EDITABLE_KEYS.forEach((k) => { editable[k] = all[k] || ''; });
  res.json(editable);
});

router.put('/', requireRole(...SYSTEM_ADMIN_ROLES), (req, res) => {
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const txn = db.transaction(() => {
    EDITABLE_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        upsert.run(key, req.body[key] ?? '');
      }
    });
  });
  txn();
  logAction(req, 'UPDATE', 'settings', null, { ...req.body, institution_logo: req.body.institution_logo ? '(logo omitted from log)' : undefined });
  res.json({ ok: true });
});

module.exports = router;
