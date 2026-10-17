const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { getAllSettings } = require('../lib/settings');
const { SYSTEM_ADMIN_ROLES } = require('../lib/roles');
const { syncToWebsite } = require('../lib/websiteSync');
const crypto = require('crypto');
const { resetJwtSecretCache } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // any authenticated role can read (currency symbol, institution name, etc.)

// Editable settings only — secondary_backup_folder is managed from the
// Backups page's own dedicated endpoint, not exposed here.
const EDITABLE_KEYS = [
  'institution_name', 'institution_address', 'institution_phone', 'institution_email',
  'institution_logo', 'currency_code', 'currency_symbol',
  'website_sync_url', 'website_sync_key',
  'allowed_origins',
];

// Branding/currency are needed by every logged-in user (nav header, money
// formatting, etc.). Everything else — the website sync secret, the CORS
// allow-list, sync status — is administrative and must never reach a
// Student/Lecturer/etc. session, even though those sessions are authenticated.
const PUBLIC_KEYS = [
  'institution_name', 'institution_address', 'institution_phone', 'institution_email',
  'institution_logo', 'currency_code', 'currency_symbol',
];

router.get('/', (req, res) => {
  const all = getAllSettings();
  const isSystemAdmin = SYSTEM_ADMIN_ROLES.includes(req.user.role);
  const keys = isSystemAdmin ? EDITABLE_KEYS : PUBLIC_KEYS;
  const result = {};
  keys.forEach((k) => { result[k] = all[k] || ''; });
  if (isSystemAdmin) result.website_last_synced_at = all.website_last_synced_at || null;
  res.json(result);
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

// Rotates the secret used to sign login sessions. Every currently signed-in
// user (including whoever clicks this) is signed out immediately, because
// their existing tokens no longer verify. Use this if a token or the
// machine itself is ever suspected to be compromised.
router.post('/rotate-secret', requireRole(...SYSTEM_ADMIN_ROLES), (req, res) => {
  const newSecret = crypto.randomBytes(48).toString('hex');
  db.prepare("INSERT INTO settings (key, value) VALUES ('jwt_secret', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(newSecret);
  resetJwtSecretCache();
  logAction(req, 'ROTATE_SECRET', 'settings', null, { ip: req.ip });
  res.json({ ok: true, message: 'All sessions have been signed out. Please sign in again.' });
});

module.exports = router;
