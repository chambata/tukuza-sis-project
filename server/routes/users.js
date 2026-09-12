const { SYSTEM_ADMIN_ROLES, STAFF_ROLES, LECTURER } = require('../lib/roles');
const { notify } = require('../lib/notifications');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(requireAuth, requireRole(...SYSTEM_ADMIN_ROLES));

router.get('/', (req, res) => {
  const users = db.prepare(
    'SELECT id, username, full_name, role, is_active, assigned_program, linked_student_id, created_at FROM users ORDER BY username'
  ).all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { username, password, full_name, role } = req.body || {};
  // Student accounts are created from a student's own profile (they must be
  // linked to a student record), not through this general-purpose endpoint.
  const validRoles = STAFF_ROLES;
  if (!username || !password || !role || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'username, password and a valid role are required' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run(username.trim(), hash, full_name || null, role);
    logAction(req, 'CREATE', 'users', info.lastInsertRowid, { username, role });
    notify(info.lastInsertRowid, 'ACCOUNT_CREATED', `Welcome — your ${role} account has been created.`, 'users', info.lastInsertRowid);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:id/status', (req, res) => {
  const { is_active } = req.body || {};
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
  logAction(req, 'UPDATE_STATUS', 'users', req.params.id, { is_active });
  res.json({ ok: true });
});

router.put('/:id/reset-password', (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  logAction(req, 'RESET_PASSWORD', 'users', req.params.id);
  res.json({ ok: true });
});

router.put('/:id/assign-program', (req, res) => {
  const { program } = req.body || {};
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  if (existing.role !== LECTURER) {
    return res.status(400).json({ error: 'Only Lecturer accounts can be assigned a programme' });
  }
  db.prepare('UPDATE users SET assigned_program = ? WHERE id = ?').run(program || null, req.params.id);
  logAction(req, 'UPDATE', 'users', req.params.id, { assigned_program: program });
  res.json({ ok: true });
});

module.exports = router;
