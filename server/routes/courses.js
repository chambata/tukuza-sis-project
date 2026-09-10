const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');
const { COURSE_WRITE_ROLES, STAFF_ROLES, LECTURER } = require('../lib/roles');

const router = express.Router();
router.use(requireAuth, requireRole(...STAFF_ROLES));

router.get('/', (req, res) => {
  const { programme_id, mine } = req.query;
  const where = [];
  const params = {};
  if (programme_id) { where.push('c.programme_id = @programme_id'); params.programme_id = programme_id; }
  // A Lecturer can ask for just their own assigned courses ("View assigned courses").
  if (mine === 'true' && req.user.role === LECTURER) {
    where.push('c.lecturer_user_id = @uid');
    params.uid = req.user.id;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT c.*, p.name AS programme_name, u.full_name AS lecturer_name
    FROM courses c
    LEFT JOIN programmes p ON p.id = c.programme_id
    LEFT JOIN users u ON u.id = c.lecturer_user_id
    ${whereSql}
    ORDER BY c.course_code
  `).all(params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const course = db.prepare(`
    SELECT c.*, p.name AS programme_name, u.full_name AS lecturer_name
    FROM courses c
    LEFT JOIN programmes p ON p.id = c.programme_id
    LEFT JOIN users u ON u.id = c.lecturer_user_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const students = db.prepare(`
    SELECT s.id, s.student_id, s.first_name, s.surname, sc.academic_year, sc.semester
    FROM student_courses sc JOIN students s ON s.id = sc.student_id
    WHERE sc.course_id = ? ORDER BY s.surname, s.first_name
  `).all(req.params.id);
  res.json({ ...course, students });
});

router.post('/', requireRole(...COURSE_WRITE_ROLES), (req, res) => {
  const { course_code, course_name, programme_id, year_of_study, semester, credit_hours, lecturer_user_id, status } = req.body || {};
  if (!course_code || !course_name) {
    return res.status(400).json({ error: 'course_code and course_name are required' });
  }
  try {
    const info = db.prepare(`
      INSERT INTO courses (course_code, course_name, programme_id, year_of_study, semester, credit_hours, lecturer_user_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      course_code.trim(), course_name.trim(), programme_id || null, year_of_study || null,
      semester || null, credit_hours || null, lecturer_user_id || null, status || 'Active'
    );
    logAction(req, 'CREATE', 'courses', info.lastInsertRowid, req.body);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A course with this code already exists' });
    }
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/:id', requireRole(...COURSE_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Course not found' });
  const b = { ...existing, ...req.body, id: req.params.id };
  try {
    db.prepare(`
      UPDATE courses SET course_code=@course_code, course_name=@course_name, programme_id=@programme_id,
        year_of_study=@year_of_study, semester=@semester, credit_hours=@credit_hours,
        lecturer_user_id=@lecturer_user_id, status=@status
      WHERE id=@id
    `).run(b);
    logAction(req, 'UPDATE', 'courses', req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A course with this code already exists' });
    }
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/:id', requireRole(...COURSE_WRITE_ROLES), (req, res) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Course not found' });
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  logAction(req, 'DELETE', 'courses', req.params.id, { course_code: existing.course_code });
  res.json({ ok: true });
});

module.exports = router;
