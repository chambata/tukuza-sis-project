const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { INTAKE_WRITE_ROLES } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM intakes ORDER BY label DESC').all());
});

router.post('/', requireRole(...INTAKE_WRITE_ROLES), (req, res) => {
  const { label } = req.body || {};
  if (!label || !label.trim()) return res.status(400).json({ error: 'Intake label is required' });
  try {
    const info = db.prepare('INSERT INTO intakes (label) VALUES (?)').run(label.trim());
    logAction(req, 'CREATE', 'intakes', info.lastInsertRowid, { label });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'This intake already exists' });
    }
    res.status(500).json({ error: 'Failed to create intake' });
  }
});

router.put('/:id/set-current', requireRole(...INTAKE_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM intakes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Intake not found' });
  const txn = db.transaction(() => {
    db.prepare('UPDATE intakes SET is_current = 0').run();
    db.prepare('UPDATE intakes SET is_current = 1 WHERE id = ?').run(req.params.id);
  });
  txn();
  logAction(req, 'UPDATE', 'intakes', req.params.id, { set_current: true });
  res.json({ ok: true });
});

router.delete('/:id', requireRole(...INTAKE_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM intakes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Intake not found' });
  const inUse = db.prepare('SELECT COUNT(*) AS c FROM students WHERE intake_id = ?').get(req.params.id).c;
  if (inUse > 0) {
    return res.status(409).json({ error: `${inUse} student(s) are still assigned to this intake` });
  }
  db.prepare('DELETE FROM intakes WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'intakes', req.params.id, { label: existing.label });
  res.json({ ok: true });
});

module.exports = router;
