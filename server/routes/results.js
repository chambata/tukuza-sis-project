const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { RESULTS_ENTRY_ROLES, RESULTS_APPROVAL_ROLES, SUPER_ADMIN, STUDENT } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth);

// Roles that can override the "locked once approved" edit/delete restriction —
// Super Administrator can always intervene; an Examinations Officer approved
// it, so they can also unlock it.
const CAN_OVERRIDE_APPROVAL_LOCK = [...RESULTS_APPROVAL_ROLES];

router.get('/', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'studentId query param required' });
  if (req.user.role === STUDENT && String(req.user.linked_student_id) !== String(studentId)) {
    return res.status(403).json({ error: 'You do not have permission to view these results' });
  }
  res.json(db.prepare(
    'SELECT * FROM results WHERE student_id = ? ORDER BY academic_year DESC, semester, type, id'
  ).all(studentId));
});

router.post('/', requireRole(...RESULTS_ENTRY_ROLES), (req, res) => {
  const { student_id, course_name, type, academic_year, semester, score, grade } = req.body || {};
  if (!student_id || !course_name) {
    return res.status(400).json({ error: 'student_id and course_name are required' });
  }
  if (type && !['CA', 'Exam'].includes(type)) {
    return res.status(400).json({ error: "type must be 'CA' or 'Exam'" });
  }
  const info = db.prepare(`
    INSERT INTO results (student_id, course_name, type, academic_year, semester, score, grade, entered_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft')
  `).run(
    student_id, course_name, type || 'Exam', academic_year || null, semester || null,
    score || null, grade || null, req.user.full_name || req.user.username
  );
  logAction(req, 'CREATE', 'results', info.lastInsertRowid, req.body);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole(...RESULTS_ENTRY_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Result not found' });
  if (existing.status === 'Approved' && !CAN_OVERRIDE_APPROVAL_LOCK.includes(req.user.role)) {
    return res.status(403).json({ error: 'This result has been approved and can only be edited by an Examinations Officer or Super Administrator' });
  }
  const b = { ...existing, ...req.body, id: req.params.id };
  db.prepare(`
    UPDATE results SET course_name=@course_name, type=@type, academic_year=@academic_year,
      semester=@semester, score=@score, grade=@grade
    WHERE id=@id
  `).run(b);
  logAction(req, 'UPDATE', 'results', req.params.id, req.body);
  res.json({ ok: true });
});

router.put('/:id/approve', requireRole(...RESULTS_APPROVAL_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Result not found' });
  db.prepare(`
    UPDATE results SET status = 'Approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?
  `).run(req.user.full_name || req.user.username, req.params.id);
  logAction(req, 'APPROVE', 'results', req.params.id);
  res.json({ ok: true });
});

router.put('/:id/unapprove', requireRole(...RESULTS_APPROVAL_ROLES), (req, res) => {
  db.prepare(`UPDATE results SET status = 'Draft', approved_by = NULL, approved_at = NULL WHERE id = ?`).run(req.params.id);
  logAction(req, 'UNAPPROVE', 'results', req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireRole(...RESULTS_ENTRY_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Result not found' });
  if (existing.status === 'Approved' && !CAN_OVERRIDE_APPROVAL_LOCK.includes(req.user.role)) {
    return res.status(403).json({ error: 'This result has been approved and can only be deleted by an Examinations Officer or Super Administrator' });
  }
  db.prepare('DELETE FROM results WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'results', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
