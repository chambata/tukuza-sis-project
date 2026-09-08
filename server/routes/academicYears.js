const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM academic_years ORDER BY label DESC').all());
});

router.post('/', requireRole('Administrator'), (req, res) => {
  const { label } = req.body || {};
  if (!label || !label.trim()) return res.status(400).json({ error: 'Academic year label is required' });
  try {
    const info = db.prepare('INSERT INTO academic_years (label) VALUES (?)').run(label.trim());
    logAction(req, 'CREATE', 'academic_years', info.lastInsertRowid, { label });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'This academic year already exists' });
    }
    res.status(500).json({ error: 'Failed to create academic year' });
  }
});

router.put('/:id/set-current', requireRole('Administrator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Academic year not found' });
  const txn = db.transaction(() => {
    db.prepare('UPDATE academic_years SET is_current = 0').run();
    db.prepare('UPDATE academic_years SET is_current = 1 WHERE id = ?').run(req.params.id);
  });
  txn();
  logAction(req, 'UPDATE', 'academic_years', req.params.id, { set_current: true });
  res.json({ ok: true });
});

router.delete('/:id', requireRole('Administrator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Academic year not found' });
  const inUse = db.prepare('SELECT COUNT(*) AS c FROM results WHERE academic_year = ?').get(existing.label).c;
  if (inUse > 0) {
    return res.status(409).json({ error: `${inUse} result(s) reference this academic year` });
  }
  db.prepare('DELETE FROM academic_years WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'academic_years', req.params.id, { label: existing.label });
  res.json({ ok: true });
});

module.exports = router;
