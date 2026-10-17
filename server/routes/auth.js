const { invalidateDefaultPasswordCache } = require('../lib/defaultPassword');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, getJwtSecret } = require('../middleware/auth');
const { logAction } = require('../audit');
const { DEFAULT_ADMIN_PASSWORD } = require('../lib/defaultPassword');
const { checkLockout, recordFailure, recordSuccess, LOCKOUT_MINUTES } = require('../lib/loginLockout');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const cleanUsername = username.trim();

  const lockout = checkLockout(cleanUsername);
  if (lockout.locked) {
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${Math.ceil(lockout.retryAfterSeconds / 60)} minute(s).`,
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(cleanUsername);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    const result = recordFailure(cleanUsername);
    if (result.locked) {
      return res.status(429).json({ error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` });
    }
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  recordSuccess(cleanUsername);
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
    linked_student_id: user.linked_student_id || null,
    assigned_program: user.assigned_program || null,
  };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '12h' });
  req.user = payload;
  logAction(req, 'LOGIN', 'users', user.id, { ip: req.ip });
  res.json({ token, user: payload, mustChangePassword: password === DEFAULT_ADMIN_PASSWORD });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  if (newPassword === DEFAULT_ADMIN_PASSWORD) {
    return res.status(400).json({ error: 'Please choose a password other than the default one.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  invalidateDefaultPasswordCache();
  logAction(req, 'CHANGE_PASSWORD', 'users', user.id);
  res.json({ ok: true });
});

module.exports = router;
