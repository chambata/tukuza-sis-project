const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM programmes ORDER BY name').all());
});

router.post('/', requireRole('Administrator'), (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Programme name is required' });
  try {
    const info = db.prepare('INSERT INTO programmes (name) VALUES (?)').run(name.trim());
    logAction(req, 'CREATE', 'programmes', info.lastInsertRowid, { name });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A programme with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create programme' });
  }
});

router.put('/:id', requireRole('Administrator'), (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Programme name is required' });
  const existing = db.prepare('SELECT * FROM programmes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Programme not found' });
  try {
    db.prepare('UPDATE programmes SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    // Keep student records in sync so renaming a programme doesn't orphan them.
    db.prepare("UPDATE students SET program = ? WHERE program = ?").run(name.trim(), existing.name);
    logAction(req, 'UPDATE', 'programmes', req.params.id, { from: existing.name, to: name });
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A programme with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update programme' });
  }
});

router.delete('/:id', requireRole('Administrator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM programmes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Programme not found' });
  const inUse = db.prepare('SELECT COUNT(*) AS c FROM students WHERE program = ?').get(existing.name).c;
  if (inUse > 0) {
    return res.status(409).json({ error: `${inUse} student(s) are still assigned to this programme` });
  }
  db.prepare('DELETE FROM programmes WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'programmes', req.params.id, { name: existing.name });
  res.json({ ok: true });
});

module.exports = router;
