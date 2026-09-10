const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { GRADE_SCALE_WRITE_ROLES, STAFF_ROLES } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth, requireRole(...STAFF_ROLES));

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM grade_scales ORDER BY sort_order').all());
});

router.post('/', requireRole(...GRADE_SCALE_WRITE_ROLES), (req, res) => {
  const { min_score, max_score, grade, remark, sort_order } = req.body || {};
  if (min_score == null || max_score == null || !grade) {
    return res.status(400).json({ error: 'min_score, max_score and grade are required' });
  }
  const info = db.prepare(
    'INSERT INTO grade_scales (min_score, max_score, grade, remark, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(Number(min_score), Number(max_score), grade, remark || grade, sort_order || 0);
  logAction(req, 'CREATE', 'grade_scales', info.lastInsertRowid, req.body);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole(...GRADE_SCALE_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM grade_scales WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Grade band not found' });
  const b = { ...existing, ...req.body, id: req.params.id };
  db.prepare(
    'UPDATE grade_scales SET min_score=@min_score, max_score=@max_score, grade=@grade, remark=@remark, sort_order=@sort_order WHERE id=@id'
  ).run(b);
  logAction(req, 'UPDATE', 'grade_scales', req.params.id, req.body);
  res.json({ ok: true });
});

router.delete('/:id', requireRole(...GRADE_SCALE_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM grade_scales WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Grade band not found' });
  db.prepare('DELETE FROM grade_scales WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'grade_scales', req.params.id, { grade: existing.grade });
  res.json({ ok: true });
});

module.exports = router;
