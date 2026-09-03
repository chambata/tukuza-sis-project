const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'studentId query param required' });
  res.json(db.prepare('SELECT * FROM results WHERE student_id = ? ORDER BY academic_year DESC, id DESC').all(studentId));
});

router.post('/', requireRole('Administrator', 'Lecturer'), (req, res) => {
  const { student_id, course_name, academic_year, semester, score, grade } = req.body || {};
  if (!student_id || !course_name) {
    return res.status(400).json({ error: 'student_id and course_name are required' });
  }
  const info = db.prepare(`
    INSERT INTO results (student_id, course_name, academic_year, semester, score, grade, entered_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(student_id, course_name, academic_year || null, semester || null, score || null, grade || null,
    req.user.full_name || req.user.username);
  logAction(req, 'CREATE', 'results', info.lastInsertRowid, req.body);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/:id', requireRole('Administrator', 'Lecturer'), (req, res) => {
  db.prepare('DELETE FROM results WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'results', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
