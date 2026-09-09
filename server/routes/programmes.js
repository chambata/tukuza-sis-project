const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { PROGRAMME_WRITE_ROLES } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT p.*, d.name AS department_name FROM programmes p
    LEFT JOIN departments d ON d.id = p.department_id
    ORDER BY p.name
  `).all());
});

router.post('/', requireRole(...PROGRAMME_WRITE_ROLES), (req, res) => {
  const { name, code, department_id, duration_years, description, is_active } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Programme name is required' });
  try {
    const info = db.prepare(`
      INSERT INTO programmes (name, code, department_id, duration_years, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(), code || null, department_id || null, duration_years || null,
      description || null, is_active === false ? 0 : 1
    );
    logAction(req, 'CREATE', 'programmes', info.lastInsertRowid, req.body);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A programme with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create programme' });
  }
});

router.put('/:id', requireRole(...PROGRAMME_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM programmes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Programme not found' });
  const b = { ...existing, ...req.body };
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Programme name is required' });
  try {
    db.prepare(`
      UPDATE programmes SET name=@name, code=@code, department_id=@department_id,
        duration_years=@duration_years, description=@description, is_active=@is_active
      WHERE id=@id
    `).run({
      name: b.name.trim(), code: b.code || null, department_id: b.department_id || null,
      duration_years: b.duration_years || null, description: b.description || null,
      is_active: b.is_active === false || b.is_active === 0 ? 0 : 1, id: req.params.id,
    });
    // Keep student records in sync so renaming a programme doesn't orphan them.
    if (b.name.trim() !== existing.name) {
      db.prepare('UPDATE students SET program = ? WHERE program = ?').run(b.name.trim(), existing.name);
    }
    logAction(req, 'UPDATE', 'programmes', req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A programme with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update programme' });
  }
});

router.delete('/:id', requireRole(...PROGRAMME_WRITE_ROLES), (req, res) => {
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
