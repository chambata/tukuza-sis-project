const express = require('express');
const db = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();
router.use(requireAuth);

router.get('/me', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.student.studentId);
  if (!student) return res.status(404).json({ error: 'Student record not found' });
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC').all(student.id);
  const results = db.prepare('SELECT * FROM results WHERE student_id = ? ORDER BY academic_year DESC, semester').all(student.id);
  delete student.password_hash;
  res.json({ ...student, payments, results });
});

module.exports = router;
