const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { DEPARTMENT_WRITE_ROLES } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM departments ORDER BY name').all());
});

router.post('/', requireRole(...DEPARTMENT_WRITE_ROLES), (req, res) => {
  const { name, code, head_of_department, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Department name is required' });
  try {
    const info = db.prepare(
      'INSERT INTO departments (name, code, head_of_department, description) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), code || null, head_of_department || null, description || null);
    logAction(req, 'CREATE', 'departments', info.lastInsertRowid, req.body);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A department with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.put('/:id', requireRole(...DEPARTMENT_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Department not found' });
  const b = { ...existing, ...req.body, id: req.params.id };
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Department name is required' });
  try {
    db.prepare(
      'UPDATE departments SET name=@name, code=@code, head_of_department=@head_of_department, description=@description WHERE id=@id'
    ).run(b);
    logAction(req, 'UPDATE', 'departments', req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A department with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.delete('/:id', requireRole(...DEPARTMENT_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Department not found' });
  const staffCount = db.prepare('SELECT COUNT(*) AS c FROM staff WHERE department_id = ?').get(req.params.id).c;
  const programmeCount = db.prepare('SELECT COUNT(*) AS c FROM programmes WHERE department_id = ?').get(req.params.id).c;
  const studentCount = db.prepare('SELECT COUNT(*) AS c FROM students WHERE department_id = ?').get(req.params.id).c;
  if (staffCount + programmeCount + studentCount > 0) {
    return res.status(409).json({
      error: `This department is still in use (${staffCount} staff, ${programmeCount} programme(s), ${studentCount} student(s))`,
    });
  }
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'departments', req.params.id, { name: existing.name });
  res.json({ ok: true });
});

module.exports = router;
