const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tukuza-portal-dev-secret-change-me';

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(username.trim());
  if (!student || !student.password_hash || !bcrypt.compareSync(password, student.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign({ studentId: student.id, student_id: student.student_id }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, student: { student_id: student.student_id, first_name: student.first_name, surname: student.surname } });
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.student = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { router, requireAuth, JWT_SECRET };
