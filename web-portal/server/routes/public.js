const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/programmes', (req, res) => {
  res.json(db.prepare('SELECT id, name, code, description, duration_years FROM programmes ORDER BY name').all());
});

router.get('/announcements', (req, res) => {
  // Only announcements meant for a public/student audience — internal
  // Staff-only announcements never get synced to this service in the first
  // place (see the desktop app's sync selection), but filter again here as
  // a second layer of defense.
  const rows = db.prepare(
    "SELECT id, title, message, target, target_programme, created_by, created_at FROM announcements WHERE target IN ('All Users','All Students','Specific Programme') ORDER BY id DESC LIMIT 20"
  ).all();
  res.json(rows);
});

router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach((r) => {
    if (r.key === 'sync_api_key') return; // never expose the sync secret publicly
    settings[r.key] = r.value;
  });
  res.json(settings);
});

module.exports = router;
