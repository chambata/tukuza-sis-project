const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { getAllSettings } = require('../lib/settings');
const { SYSTEM_ADMIN_ROLES } = require('../lib/roles');
const { syncToWebsite } = require('../lib/websiteSync');

const router = express.Router();
router.use(requireAuth); // any authenticated role can read (currency symbol, institution name, etc.)

// Editable settings only — secondary_backup_folder is managed from the
// Backups page's own dedicated endpoint, not exposed here.
const EDITABLE_KEYS = [
  'institution_name', 'institution_address', 'institution_phone', 'institution_email',
  'institution_logo', 'currency_code', 'currency_symbol',
  'website_sync_url', 'website_sync_key',
];

router.get('/', (req, res) => {
  const all = getAllSettings();
  const editable = {};
  EDITABLE_KEYS.forEach((k) => { editable[k] = all[k] || ''; });
  editable.website_last_synced_at = all.website_last_synced_at || null;
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
  logAction(req, 'UPDATE', 'settings', null, { ...req.body, institution_logo: req.body.institution_logo ? '(logo omitted from log)' : undefined, website_sync_key: req.body.website_sync_key ? '(key omitted from log)' : undefined });
  res.json({ ok: true });
});

router.post('/sync-website', requireRole(...SYSTEM_ADMIN_ROLES), async (req, res) => {
  try {
    const result = await syncToWebsite();
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('website_last_synced_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(new Date().toISOString());
    logAction(req, 'SYNC', 'website', null, result.counts);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Website sync failed' });
  }
});

module.exports = router;
